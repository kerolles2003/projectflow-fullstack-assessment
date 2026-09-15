import { IsMongoId, ValidateIf } from 'class-validator';

export class UpdateTaskAssigneeDto {
  @ValidateIf((_object, value: unknown) => value !== null)
  @IsMongoId()
  assigneeId: string | null;
}
