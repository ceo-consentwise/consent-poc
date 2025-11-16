"""add consent templates and versioning columns

Revision ID: b06f365657a7
Revises: a8829b71c4f6
Create Date: 2025-11-15 18:26:50.832795

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b06f365657a7'
down_revision: Union[str, Sequence[str], None] = 'a8829b71c4f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
