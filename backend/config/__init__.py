# PyMySQL is pure Python, so no MySQL client headers are needed on the VM or laptops.
import pymysql

pymysql.install_as_MySQLdb()
