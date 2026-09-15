import type { INestApplication } from '@nestjs/common';
import type { Connection } from 'mongoose';
import request from 'supertest';
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
