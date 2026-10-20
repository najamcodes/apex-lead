import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class InitialBaseline1700000000000 implements MigrationInterface {
  name = 'InitialBaseline1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'organizations',
        columns: [
          { name: 'id', type: 'integer', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'name', type: 'varchar', isNullable: false },
          { name: 'plan', type: 'varchar', default: "'free'" },
          { name: 'settings', type: 'text', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true
    );

    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          { name: 'id', type: 'integer', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'email', type: 'varchar', isUnique: true, isNullable: false },
          { name: 'password_hash', type: 'varchar', isNullable: false },
          { name: 'name', type: 'varchar', isNullable: true },
          { name: 'role', type: 'varchar', default: "'viewer'" },
          { name: 'permissions', type: 'text', default: "'[]'" },
          { name: 'default_org_id', type: 'integer', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true
    );

    await queryRunner.createTable(
      new Table({
        name: 'user_organizations',
        columns: [
          { name: 'id', type: 'integer', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'user_id', type: 'integer', isNullable: false },
          { name: 'org_id', type: 'integer', isNullable: false },
          { name: 'role', type: 'varchar', default: "'member'" },
          { name: 'permissions', type: 'text', default: "'[]'" },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true
    );

    await queryRunner.createTable(
      new Table({
        name: 'leads',
        columns: [
          { name: 'id', type: 'integer', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'org_id', type: 'integer', default: 1 },
          { name: 'business_name', type: 'varchar', isNullable: false },
          { name: 'website', type: 'varchar', isNullable: true },
          { name: 'email', type: 'varchar', isNullable: true },
          { name: 'phone', type: 'varchar', isNullable: true },
          { name: 'address', type: 'text', isNullable: true },
          { name: 'status', type: 'varchar', default: "'new'" },
          { name: 'score', type: 'integer', default: 0 },
          { name: 'data', type: 'text', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('leads', true);
    await queryRunner.dropTable('user_organizations', true);
    await queryRunner.dropTable('users', true);
    await queryRunner.dropTable('organizations', true);
  }
}
