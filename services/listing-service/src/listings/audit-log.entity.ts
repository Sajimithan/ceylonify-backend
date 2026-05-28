import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  action!: string;

  @Column()
  adminFirebaseUid!: string;

  @Column({ nullable: true })
  resourceId?: string;

  @Column({ type: 'text', nullable: true })
  details?: string;

  @CreateDateColumn()
  createdAt!: Date;
}
