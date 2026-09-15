import type { INestApplication } from '@nestjs/common';
import type { Connection } from 'mongoose';
import request from 'supertest';
import type { TaskDetail } from '@projectflow/shared';
import { OrganizationRole, ProjectRole, TaskPriority, TaskStatus } from '@projectflow/shared';
import { createTestApp, resetDatabase } from './utils/test-app';
import {
  addOrganizationMember,
  addProjectMember,
  authHeader,
  createOrganization,
  createProject,
  createTask,
  registerUser,
  type TestUser,
} from './utils/fixtures';

describe('Tasks', () => {
  let app: INestApplication;
  let connection: Connection;

  let owner: TestUser;
  let member: TestUser;
  let outsider: TestUser;
  let projectId: string;
  let organizationId: string;

  beforeAll(async () => {
    ({ app, connection } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(connection);

    owner = await registerUser(app, 'Ammar Yaser', 'ammar@example.com');
    member = await registerUser(app, 'Magd Ali', 'magd@example.com');
    outsider = await registerUser(app, 'Outside User', 'outside@example.com');

    organizationId = await createOrganization(
      connection,
      'Acme Software',
      'acme-software',
      owner.id,
    );
    await addOrganizationMember(connection, organizationId, owner.id, OrganizationRole.OWNER);
    await addOrganizationMember(connection, organizationId, member.id, OrganizationRole.MEMBER);

    projectId = await createProject(
      connection,
      organizationId,
      'Internal Platform',
      'ENG',
      owner.id,
    );
    await addProjectMember(connection, projectId, member.id, ProjectRole.MEMBER);
  });

  it('lets a project member create a task', async () => {
    const response = await request(app.getHttpServer())
      .post(`/projects/${projectId}/tasks`)
      .set('Authorization', authHeader(member))
      .send({
        title: 'Improve API error handling',
        description: 'Normalise validation and permission errors.',
        priority: TaskPriority.HIGH,
      })
      .expect(201);

    expect(response.body).toMatchObject({
      key: 'ENG-1',
      number: 1,
      title: 'Improve API error handling',
      status: TaskStatus.TODO,
      priority: TaskPriority.HIGH,
    });
    expect(response.body.createdBy).toMatchObject({ email: 'magd@example.com' });
  });

  it('numbers tasks sequentially within a project', async () => {
    for (const title of ['First task', 'Second task', 'Third task']) {
      await request(app.getHttpServer())
        .post(`/projects/${projectId}/tasks`)
        .set('Authorization', authHeader(member))
        .send({ title })
        .expect(201);
    }

    const response = await request(app.getHttpServer())
      .get(`/projects/${projectId}/tasks`)
      .set('Authorization', authHeader(member))
      .expect(200);

    expect(response.body.total).toBe(3);
    expect(response.body.items.map((task: { key: string }) => task.key)).toEqual([
      'ENG-1',
      'ENG-2',
      'ENG-3',
    ]);
  });

  describe('concurrent numbering', () => {
    const objectId = (id: string) => new connection.base.Types.ObjectId(id);
    const postTask = async (id: string, title: string): Promise<TaskDetail> => {
      const response = await request(app.getHttpServer())
        .post(`/projects/${id}/tasks`)
        .set('Authorization', authHeader(member))
        .send({ title })
        .expect(201);
      return response.body as TaskDetail;
    };

    async function verifyAllocation(id: string, key: string, tasks: TaskDetail[], count: number) {
      const expected = Array.from({ length: count }, (_, i) => i + 1);
      expect(tasks).toHaveLength(count);
      expect(tasks.map((task) => task.number).sort((a, b) => a - b)).toEqual(expected);
      const stored = await connection
        .collection('tasks')
        .find({ projectId: objectId(id) })
        .toArray();
      expect(stored).toHaveLength(count);
      expect(new Set(stored.map((task) => task.number)).size).toBe(count);
      const byId = new Map(stored.map((task) => [task._id.toString(), task]));
      for (const task of tasks) {
        expect(task.projectId).toBe(id);
        expect(task.key).toBe(`${key}-${task.number}`);
        const persisted = byId.get(task.id);
        expect(persisted?.number).toBe(task.number);
        expect(persisted?.key).toBe(task.key);
        expect(persisted?.projectId.toString()).toBe(id);
      }
      const project = await connection.collection('projects').findOne({ _id: objectId(id) });
      expect(project?.lastTaskNumber).toBe(count);
    }

    it('allocates 20 distinct persisted numbers for parallel requests in one project', async () => {
      const tasks = await Promise.all(
        Array.from({ length: 20 }, (_, i) => postTask(projectId, `Parallel task ${i}`)),
      );
      await verifyAllocation(projectId, 'ENG', tasks, 20);
    });

    it('allocates independent overlapping sequences across two projects concurrently', async () => {
      const secondId = await createProject(
        connection,
        organizationId,
        'Second project',
        'WEB',
        owner.id,
      );
      await addProjectMember(connection, secondId, member.id, ProjectRole.MEMBER);
      const tasks = await Promise.all(
        Array.from({ length: 10 }, (_, i) => [
          postTask(projectId, `ENG parallel ${i}`),
          postTask(secondId, `WEB parallel ${i}`),
        ]).flat(),
      );
      const first = tasks.filter((task) => task.projectId === projectId);
      const second = tasks.filter((task) => task.projectId === secondId);
      await verifyAllocation(projectId, 'ENG', first, 10);
      await verifyAllocation(secondId, 'WEB', second, 10);
      expect(first.some((task) => task.number === 1)).toBe(true);
      expect(second.some((task) => task.number === 1)).toBe(true);
    });

    it('does not reuse a deleted number or decrement the project counter', async () => {
      const first = await postTask(projectId, 'First task');
      const second = await postTask(projectId, 'Second task');
      const third = await postTask(projectId, 'Third task');
      expect([first.number, second.number, third.number]).toEqual([1, 2, 3]);
      await request(app.getHttpServer())
        .delete(`/tasks/${second.id}`)
        .set('Authorization', authHeader(owner))
        .expect(204);
      expect(await connection.collection('tasks').findOne({ _id: objectId(second.id) })).toBeNull();
      expect(
        (await connection.collection('projects').findOne({ _id: objectId(projectId) }))
          ?.lastTaskNumber,
      ).toBe(3);
      const fourth = await postTask(projectId, 'Fourth task');
      expect(fourth.number).toBe(4);
      expect(fourth.key).toBe('ENG-4');
      const stored = await connection
        .collection('tasks')
        .find({ projectId: objectId(projectId) })
        .sort({ number: 1 })
        .toArray();
      expect(stored.map((task) => task.number)).toEqual([1, 3, 4]);
      expect(stored.find((task) => task._id.toString() === fourth.id)?.number).toBe(4);
      expect(
        (await connection.collection('projects').findOne({ _id: objectId(projectId) }))
          ?.lastTaskNumber,
      ).toBe(4);
    });

    it('deploys a unique project/number index in MongoDB', async () => {
      await connection.models.Task!.init();
      const indexes = await connection.collection('tasks').indexes();
      expect(indexes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: { projectId: 1, number: 1 }, unique: true }),
        ]),
      );
    });
  });

  it('refuses to create a task for someone outside the project', async () => {
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/tasks`)
      .set('Authorization', authHeader(outsider))
      .send({ title: 'Should not be created' })
      .expect(403);
  });

  it('refuses to list tasks for someone outside the project', async () => {
    await request(app.getHttpServer())
      .get(`/projects/${projectId}/tasks`)
      .set('Authorization', authHeader(outsider))
      .expect(403);
  });

  it('denies task mutations by a same-organization member of another project without changing persistence', async () => {
    await addOrganizationMember(connection, organizationId, outsider.id, OrganizationRole.MEMBER);
    const otherProjectId = await createProject(
      connection,
      organizationId,
      'Other project',
      'OTHER',
      owner.id,
    );
    await addProjectMember(connection, otherProjectId, outsider.id, ProjectRole.MEMBER);
    const taskId = await createTask(connection, projectId, 'ENG', 1, 'Protected task', member.id);
    const filter = { _id: new connection.base.Types.ObjectId(taskId) };
    const before = await connection.collection('tasks').findOne(filter);
    expect(before?.status).toBe(TaskStatus.TODO);

    await request(app.getHttpServer())
      .get(`/tasks/${taskId}`)
      .set('Authorization', authHeader(outsider))
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/tasks/${taskId}/status`)
      .set('Authorization', authHeader(outsider))
      .send({ status: TaskStatus.IN_PROGRESS })
      .expect(403);
    expect(await connection.collection('tasks').findOne(filter)).toEqual(before);
    await request(app.getHttpServer())
      .patch(`/tasks/${taskId}`)
      .set('Authorization', authHeader(outsider))
      .send({ title: 'Unauthorized edit' })
      .expect(403);
    expect(await connection.collection('tasks').findOne(filter)).toEqual(before);
    await request(app.getHttpServer())
      .delete(`/tasks/${taskId}`)
      .set('Authorization', authHeader(outsider))
      .expect(403);
    expect(await connection.collection('tasks').findOne(filter)).toEqual(before);
  });

  it.each(['member', 'owner', 'admin'] as const)(
    'allows an authorized %s to change status and persists the response',
    async (role) => {
      const taskId = await createTask(connection, projectId, 'ENG', 1, 'Status task', outsider.id);
      let actor = member;
      if (role === 'owner') actor = owner;
      if (role === 'admin') {
        await addOrganizationMember(
          connection,
          organizationId,
          outsider.id,
          OrganizationRole.ADMIN,
        );
        actor = outsider;
      }
      const response = await request(app.getHttpServer())
        .patch(`/tasks/${taskId}/status`)
        .set('Authorization', authHeader(actor))
        .send({ status: TaskStatus.IN_PROGRESS })
        .expect(200);
      expect(response.body).toMatchObject({
        id: taskId,
        projectId,
        status: TaskStatus.IN_PROGRESS,
        project: { id: projectId, key: 'ENG' },
      });
      const persisted = await connection.collection('tasks').findOne({
        _id: new connection.base.Types.ObjectId(taskId),
      });
      expect(persisted?.status).toBe(TaskStatus.IN_PROGRESS);
      expect(persisted?.createdBy.toString()).toBe(outsider.id);
    },
  );

  describe('assignment policy', () => {
    let taskId: string;
    const objectId = (id: string) => new connection.base.Types.ObjectId(id);
    const readTask = () => connection.collection('tasks').findOne({ _id: objectId(taskId) });
    const events = () =>
      connection
        .collection('task_activities')
        .find({ taskId: objectId(taskId) })
        .sort({ createdAt: 1, _id: 1 })
        .toArray();
    const assign = (actor: TestUser, assigneeId: string | null) =>
      request(app.getHttpServer())
        .patch(`/tasks/${taskId}/assignee`)
        .set('Authorization', authHeader(actor))
        .send({ assigneeId });

    beforeEach(async () => {
      await connection.models.TaskActivity!.init();
      taskId = await createTask(connection, projectId, 'ENG', 1, 'Assignment target', owner.id);
    });

    async function expectDenied(actor: TestUser, target: string | null, status: number) {
      const before = await readTask();
      const history = await events();
      await assign(actor, target).expect(status);
      expect(await readTask()).toEqual(before);
      expect(await events()).toEqual(history);
    }

    it.each(['owner', 'admin', 'project manager'] as const)(
      'allows %s to assign a project member atomically',
      async (role) => {
        let actor = owner;
        if (role === 'admin') {
          await addOrganizationMember(
            connection,
            organizationId,
            outsider.id,
            OrganizationRole.ADMIN,
          );
          actor = outsider;
        }
        if (role === 'project manager') {
          await addProjectMember(connection, projectId, outsider.id, ProjectRole.PROJECT_MANAGER);
          actor = outsider;
        }
        const response = await assign(actor, member.id).expect(200);
        expect(response.body.assigneeId).toBe(member.id);
        expect((await readTask())?.assigneeId.toString()).toBe(member.id);
        expect((await readTask())?.createdBy.toString()).toBe(owner.id);
        const history = await events();
        expect(history).toHaveLength(1);
        expect(history[0]).toMatchObject({
          taskId: objectId(taskId),
          actorId: objectId(actor.id),
          type: 'TASK_ASSIGNEE_CHANGED',
          metadata: { from: null, to: objectId(member.id) },
        });
        expect(history[0]?.createdAt).toBeInstanceOf(Date);
      },
    );

    it('allows a noncreator member to self-assign and clear their own assignment', async () => {
      await assign(member, member.id).expect(200);
      expect((await readTask())?.assigneeId.toString()).toBe(member.id);
      await assign(member, null).expect(200);
      expect((await readTask())?.assigneeId).toBeNull();
      const history = await events();
      expect(history).toHaveLength(2);
      expect(history.map((event) => event.metadata)).toEqual([
        { from: null, to: objectId(member.id) },
        { from: objectId(member.id), to: null },
      ]);
    });

    it('rejects member assignment to another member and clearing another assignment', async () => {
      await addProjectMember(connection, projectId, outsider.id, ProjectRole.MEMBER);
      await expectDenied(member, outsider.id, 403);
      await assign(owner, outsider.id).expect(200);
      await expectDenied(member, null, 403);
      await expectDenied(member, outsider.id, 403); // No-op cannot bypass actor policy.
    });

    it('rejects unauthorized actors even for null no-ops', async () => {
      await expectDenied(outsider, member.id, 403);
      await expectDenied(outsider, null, 403);
    });

    it('rejects nonmember and elevated nonmember targets', async () => {
      await expectDenied(owner, outsider.id, 400);
      await expectDenied(owner, owner.id, 400);
    });

    it('rejects a target belonging only to another project', async () => {
      const other = await createProject(
        connection,
        organizationId,
        'Other project',
        'OTHER',
        owner.id,
      );
      await addProjectMember(connection, other, outsider.id, ProjectRole.MEMBER);
      await expectDenied(owner, outsider.id, 400);
    });

    it('rejects a membership row ID as a user target', async () => {
      const row = await connection
        .collection('project_members')
        .findOne({ projectId: objectId(projectId), userId: objectId(member.id) });
      await expectDenied(owner, row!._id.toString(), 400);
    });

    it.each([
      {},
      { assigneeId: 'invalid' },
      { assigneeId: 123 },
      { assigneeId: null, projectId: 'spoofed' },
    ])('rejects invalid assignment body %j without writing', async (body) => {
      const before = await readTask();
      await request(app.getHttpServer())
        .patch(`/tasks/${taskId}/assignee`)
        .set('Authorization', authHeader(owner))
        .send(body)
        .expect(400);
      expect(await readTask()).toEqual(before);
      expect(await events()).toHaveLength(0);
    });

    it('serializes new and legacy tasks as unassigned', async () => {
      const created = await request(app.getHttpServer())
        .post(`/projects/${projectId}/tasks`)
        .set('Authorization', authHeader(member))
        .send({ title: 'New unassigned task' })
        .expect(201);
      expect(created.body.assigneeId).toBeNull();
      expect(
        (await connection.collection('tasks').findOne({ _id: objectId(created.body.id) }))
          ?.assigneeId,
      ).toBeNull();
      expect(await readTask()).not.toHaveProperty('assigneeId'); // Raw legacy fixture.
      const legacy = await request(app.getHttpServer())
        .get(`/tasks/${taskId}`)
        .set('Authorization', authHeader(member))
        .expect(200);
      expect(legacy.body.assigneeId).toBeNull();
    });

    it('records reassignment and manager clear, but no events or writes for no-ops', async () => {
      await addProjectMember(connection, projectId, outsider.id, ProjectRole.MEMBER);
      await assign(member, null).expect(200);
      expect(await events()).toHaveLength(0);
      await assign(owner, member.id).expect(200);
      const before = await readTask();
      await assign(owner, member.id).expect(200);
      expect(await readTask()).toEqual(before);
      expect(await events()).toHaveLength(1);
      await assign(owner, outsider.id).expect(200);
      await assign(owner, null).expect(200);
      const cleared = await readTask();
      await assign(member, null).expect(200);
      expect(await readTask()).toEqual(cleared);
      expect(cleared?.assigneeId).toBeNull();
      expect((await events()).map((event) => event.metadata)).toEqual([
        { from: null, to: objectId(member.id) },
        { from: objectId(member.id), to: objectId(outsider.id) },
        { from: objectId(outsider.id), to: null },
      ]);
    });

    it('revalidates target membership on an assignment no-op', async () => {
      await assign(owner, member.id).expect(200);
      await connection
        .collection('project_members')
        .deleteOne({ projectId: objectId(projectId), userId: objectId(member.id) });
      await expectDenied(owner, member.id, 400);
    });

    it('keeps concurrent assignment events consistent with the committed task', async () => {
      await addProjectMember(connection, projectId, outsider.id, ProjectRole.MEMBER);
      const responses = await Promise.all([
        assign(owner, member.id).expect(200),
        assign(owner, outsider.id).expect(200),
      ]);
      expect(responses.map((response) => response.body.assigneeId).sort()).toEqual(
        [member.id, outsider.id].sort(),
      );
      const history = await events();
      expect(history).toHaveLength(2);
      const initial = history.find((event) => event.metadata.from === null);
      const subsequent = history.find((event) => event.metadata.from !== null);
      expect(initial).toBeDefined();
      expect(subsequent?.metadata.from.toString()).toBe(initial?.metadata.to.toString());
      expect((await readTask())?.assigneeId.toString()).toBe(subsequent?.metadata.to.toString());
      expect(history.every((event) => event.actorId.toString() === owner.id)).toBe(true);
    });

    it('aborts the task write when Mongo rejects activity persistence', async () => {
      const before = await readTask();
      await connection.db!.command({
        collMod: 'task_activities',
        validator: { type: 'REJECT_TEST_EVENTS' },
        validationLevel: 'strict',
        validationAction: 'error',
      });
      try {
        await assign(owner, member.id).expect(500);
        expect(await readTask()).toEqual(before);
        expect(await events()).toHaveLength(0);
      } finally {
        await connection.db!.command({ collMod: 'task_activities', validator: {} });
      }
    });
  });

  it('rejects a task without a usable title', async () => {
    const response = await request(app.getHttpServer())
      .post(`/projects/${projectId}/tasks`)
      .set('Authorization', authHeader(member))
      .send({ title: 'ab' })
      .expect(400);

    expect(response.body.statusCode).toBe(400);
  });

  it('filters the task list by status', async () => {
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/tasks`)
      .set('Authorization', authHeader(member))
      .send({ title: 'Work in flight', status: TaskStatus.IN_PROGRESS })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/projects/${projectId}/tasks`)
      .set('Authorization', authHeader(member))
      .send({ title: 'Not started yet' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get(`/projects/${projectId}/tasks`)
      .query({ status: TaskStatus.IN_PROGRESS })
      .set('Authorization', authHeader(member))
      .expect(200);

    expect(response.body.total).toBe(1);
    expect(response.body.items[0]).toMatchObject({ title: 'Work in flight' });
  });
});
