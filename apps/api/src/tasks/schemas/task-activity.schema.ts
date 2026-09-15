import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Types } from 'mongoose';

@Schema({ _id: false })
class AssigneeChange {
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  from: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  to: Types.ObjectId | null;
}

@Schema({ timestamps: true, collection: 'task_activities' })
export class TaskActivity {
  @Prop({ type: Types.ObjectId, ref: 'Task', required: true })
  taskId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  actorId: Types.ObjectId;

  @Prop({ type: String, enum: ['TASK_ASSIGNEE_CHANGED'], required: true })
  type: 'TASK_ASSIGNEE_CHANGED';

  @Prop({ type: SchemaFactory.createForClass(AssigneeChange), required: true })
  metadata: AssigneeChange;

  createdAt: Date;
  updatedAt: Date;
}

export type TaskActivityDocument = HydratedDocument<TaskActivity>;
export const TaskActivitySchema = SchemaFactory.createForClass(TaskActivity);
TaskActivitySchema.index({ taskId: 1, createdAt: -1, _id: -1 });
