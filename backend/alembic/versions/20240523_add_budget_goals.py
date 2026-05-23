"""add budget_goals table

Revision ID: 20240523_budget
Revises: 96cf7a8514ff
Create Date: 2026-05-23 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '20240523_budget'
down_revision: Union[str, Sequence[str], None] = '96cf7a8514ff'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'budget_goals',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('category', sa.String(100), nullable=False),
        sa.Column('budget_limit', sa.BigInteger(), nullable=False),
        sa.Column('month', sa.String(7), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )
    op.create_index('idx_budget_goals_user_id', 'budget_goals', ['user_id'])
    op.create_index('idx_budget_goals_user_month', 'budget_goals', ['user_id', 'month'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('idx_budget_goals_user_month', 'budget_goals')
    op.drop_index('idx_budget_goals_user_id', 'budget_goals')
    op.drop_table('budget_goals')
