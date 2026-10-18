from django.db.backends.sqlite3 import base


class DatabaseWrapper(base.DatabaseWrapper):
    """SQLite that takes the write lock when a transaction starts (BEGIN IMMEDIATE).

    With a plain BEGIN, a transaction that reads and then writes fails at once with "database is locked" if
    another connection is writing, instead of waiting. Starting with the lock makes it wait (the busy timeout)
    like any other write. Django 4.2 has no setting for this; 5.1 adds OPTIONS["transaction_mode"].
    """

    def _start_transaction_under_autocommit(self):
        self.cursor().execute("BEGIN IMMEDIATE")
