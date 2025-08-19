from alembic import op
import sqlalchemy as sa

revision = "20250819_0001"
down_revision = None

def upgrade():
    op.create_table("users",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("email", sa.Text(), unique=True, nullable=False),
        sa.Column("display_name", sa.Text()),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"))
    )
    op.create_table("machines",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id")),
        sa.Column("hostname", sa.Text()),
        sa.Column("ts_device_id", sa.Text()),
        sa.Column("last_seen", sa.TIMESTAMP(timezone=True)),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"))
    )
    op.create_table("auth_keys",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id")),
        sa.Column("machine_id", sa.String(), sa.ForeignKey("machines.id")),
        sa.Column("ts_key_id", sa.Text()),
        sa.Column("authkey_ciphertext", sa.Text(), nullable=False),
        sa.Column("masked", sa.Text(), nullable=False),
        sa.Column("reusable", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("ephemeral", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("preauthorized", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("tags", sa.Text()),
        sa.Column("ttl_seconds", sa.Integer(), nullable=False),
        sa.Column("active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()")),
        sa.Column("expires_at", sa.TIMESTAMP(timezone=True))
    )
    op.create_table("events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.String()),
        sa.Column("machine_id", sa.String()),
        sa.Column("type", sa.Text(), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"))
    )

def downgrade():
    op.drop_table("events")
    op.drop_table("auth_keys")
    op.drop_table("machines")
    op.drop_table("users")
