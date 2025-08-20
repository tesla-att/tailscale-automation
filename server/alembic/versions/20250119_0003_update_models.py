"""Update models to match router expectations

Revision ID: 20250119_0003
Revises: 20250819_0002
Create Date: 2025-01-19 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '20250119_0003'
down_revision = '20250819_0002'
branch_labels = None
depends_on = None

def upgrade():
    # Add new columns to users table
    op.add_column('users', sa.Column('name', sa.String(), nullable=True))
    op.add_column('users', sa.Column('is_active', sa.Boolean(), nullable=True, server_default=sa.text('true')))
    op.add_column('users', sa.Column('last_login', sa.TIMESTAMP(timezone=True), nullable=True))
    
    # Add new columns to auth_keys table
    op.add_column('auth_keys', sa.Column('description', sa.String(), nullable=True))
    op.add_column('auth_keys', sa.Column('key_encrypted', sa.Text(), nullable=True))
    op.add_column('auth_keys', sa.Column('key_masked', sa.String(), nullable=True))
    op.add_column('auth_keys', sa.Column('revoked', sa.Boolean(), nullable=True, server_default=sa.text('false')))
    op.add_column('auth_keys', sa.Column('revoked_at', sa.TIMESTAMP(timezone=True), nullable=True))
    op.add_column('auth_keys', sa.Column('uses', sa.Integer(), nullable=True, server_default=sa.text('0')))
    
    # Create devices table
    op.create_table('devices',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('ts_device_id', sa.String(), nullable=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('hostname', sa.String(), nullable=True),
        sa.Column('ip', sa.String(), nullable=True),
        sa.Column('os', sa.String(), nullable=True),
        sa.Column('user_id', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=True, server_default='offline'),
        sa.Column('last_seen', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('tags', sa.Text(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.UniqueConstraint('ts_device_id')
    )
    
    # Create audit_logs table
    op.create_table('audit_logs',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=True),
        sa.Column('action', sa.String(), nullable=False),
        sa.Column('resource', sa.String(), nullable=True),
        sa.Column('resource_id', sa.String(), nullable=True),
        sa.Column('details', sa.Text(), nullable=True),
        sa.Column('ip_address', sa.String(), nullable=True),
        sa.Column('timestamp', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], )
    )
    
    # Create deployment_logs table
    op.create_table('deployment_logs',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('action', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('details', sa.Text(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create system_metrics table
    op.create_table('system_metrics',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('metric_name', sa.String(), nullable=False),
        sa.Column('metric_value', sa.String(), nullable=True),
        sa.Column('metadata', sa.Text(), nullable=True),
        sa.Column('timestamp', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

def downgrade():
    # Drop new tables
    op.drop_table('system_metrics')
    op.drop_table('deployment_logs')
    op.drop_table('audit_logs')
    op.drop_table('devices')
    
    # Remove new columns from auth_keys
    op.drop_column('auth_keys', 'uses')
    op.drop_column('auth_keys', 'revoked_at')
    op.drop_column('auth_keys', 'revoked')
    op.drop_column('auth_keys', 'key_masked')
    op.drop_column('auth_keys', 'key_encrypted')
    op.drop_column('auth_keys', 'description')
    
    # Remove new columns from users
    op.drop_column('users', 'last_login')
    op.drop_column('users', 'is_active')
    op.drop_column('users', 'name')
