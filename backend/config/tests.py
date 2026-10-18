import os
import sqlite3
import tempfile

from django.db import connection, connections
from django.test import SimpleTestCase

from config.sqlite.base import DatabaseWrapper


class ImmediateSqliteTests(SimpleTestCase):
    def test_settings_use_it_without_db_host(self):
        if connection.vendor == "sqlite":
            self.assertIsInstance(connections["default"], DatabaseWrapper)

    def test_a_transaction_holds_the_write_lock_before_it_writes(self):
        fd, path = tempfile.mkstemp(suffix=".sqlite3")
        os.close(fd)
        self.addCleanup(os.remove, path)
        wrapper = DatabaseWrapper({**connection.settings_dict, "NAME": path})
        self.addCleanup(wrapper.close)
        other = sqlite3.connect(path, timeout=0, isolation_level=None)
        self.addCleanup(other.close)

        wrapper.set_autocommit(True)
        wrapper.cursor().execute("CREATE TABLE t (x INTEGER)")
        with wrapper.cursor() as cursor:
            wrapper._start_transaction_under_autocommit()
            cursor.execute("SELECT count(*) FROM t")  # only a read so far
            with self.assertRaisesRegex(sqlite3.OperationalError, "locked"):
                other.execute("BEGIN IMMEDIATE")  # another writer can't start; with a plain BEGIN it could
            cursor.execute("ROLLBACK")
