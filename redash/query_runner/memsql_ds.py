import logging
import sys

from redash.query_runner import *
from redash.utils import json_dumps

logger = logging.getLogger(__name__)

try:
    from memsql.common import database
    enabled = True
except ImportError:
    enabled = False

COLUMN_NAME = 0
COLUMN_TYPE = 1

types_map = {
    'BIGINT': TYPE_INTEGER,
    'TINYINT': TYPE_INTEGER,
    'SMALLINT': TYPE_INTEGER,
    'MEDIUMINT': TYPE_INTEGER,
    'INT': TYPE_INTEGER,
    'DOUBLE': TYPE_FLOAT,
    'DECIMAL': TYPE_FLOAT,
    'FLOAT': TYPE_FLOAT,
    'REAL': TYPE_FLOAT,
    'BOOL': TYPE_BOOLEAN,
    'BOOLEAN': TYPE_BOOLEAN,
    'TIMESTAMP': TYPE_DATETIME,
    'DATETIME': TYPE_DATETIME,
    'DATE': TYPE_DATETIME,
    'JSON': TYPE_STRING,
    'CHAR': TYPE_STRING,
    'VARCHAR': TYPE_STRING
}


class MemSQL(BaseSQLQueryRunner):
    noop_query = 'SELECT 1'

    @classmethod
    def configuration_schema(cls):
        return {
            "type": "object",
            "properties": {
                "host": {
                    "type": "string"
                },
                "port": {
                    "type": "number"
                },
                "user": {
                    "type": "string"
                },
                "password": {
                    "type": "string"
                },
                "toggle_table_string": {
                    "type": "string",
                    "title": "Toggle Table String",
                    "default": "_v",
                    "info": "This string will be used to toggle visibility of tables in the schema browser when editing a query in order to remove non-useful tables from sight."
                }

            },
            "required": ["host", "port"],
            "secret": ["password"]
        }

    @classmethod
    def annotate_query(cls):
        return False

    @classmethod
    def type(cls):
        return "memsql"

    @classmethod
    def enabled(cls):
        return enabled

    def _get_tables(self, schema):
        schemas_query = "show schemas"

        tables_query = "show tables in %s"

        columns_query = "show columns in %s"

        for schema_name in filter(lambda a: len(a) > 0,
                                  map(lambda a: str(a['Database']), self._run_query_internal(schemas_query))):
            for table_name in filter(lambda a: len(a) > 0, map(lambda a: str(a['Tables_in_%s' % schema_name]),
                                                               self._run_query_internal(
                                                                       tables_query % schema_name))):
                table_name = '.'.join((schema_name, table_name))
                columns = filter(lambda a: len(a) > 0, map(lambda a: str(a['Field']),
                                                           self._run_query_internal(columns_query % table_name)))

                schema[table_name] = {'name': table_name, 'columns': columns}
        return schema.values()

    def run_query(self, query, user):

        cursor = None
        try:
            cursor = database.connect(**self.configuration.to_dict())

            res = cursor.query(query)
            # column_names = []
            # columns = []
            #
            # for column in cursor.description:
            #     column_name = column[COLUMN_NAME]
            #     column_names.append(column_name)
            #
            #     columns.append({
            #         'name': column_name,
            #         'friendly_name': column_name,
            #         'type': types_map.get(column[COLUMN_TYPE], None)
            #     })

            rows = [dict(zip(list(row.keys()), list(row.values()))) for row in res]

            # ====================================================================================================
            # temporary - until https://github.com/memsql/memsql-python/pull/8 gets merged
            # ====================================================================================================
            columns = []
            column_names = rows[0].keys() if rows else None

            if column_names:
                for column in column_names:
                    columns.append({
                        'name': column,
                        'friendly_name': column,
                        'type': TYPE_STRING
                    })

            data = {'columns': columns, 'rows': rows}
            json_data = json_dumps(data)
            error = None
        except KeyboardInterrupt:
            cursor.close()
            error = "Query cancelled by user."
            json_data = None
        finally:
            if cursor:
                cursor.close()

        return json_data, error


register(MemSQL)
