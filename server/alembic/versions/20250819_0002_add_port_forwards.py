from alembic import op
import sqlalchemy as sa

revision = "20250819_0002"
down_revision = "20250819_0001"

def upgrade():
    op.create_table("port_forwards",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id")),
        sa.Column("machine_id", sa.String(), sa.ForeignKey("machines.id"), nullable=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("source_port", sa.Integer(), nullable=False),
        sa.Column("target_host", sa.Text(), nullable=False),
        sa.Column("target_port", sa.Integer(), nullable=False),
        sa.Column("protocol", sa.String(), server_default="tcp", nullable=False),
        sa.Column("active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("description", sa.Text()),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"))
    )

def downgrade():
    op.drop_table("port_forwards")
