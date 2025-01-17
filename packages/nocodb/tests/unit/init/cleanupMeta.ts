import { Base, Model } from '~/models';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { orderedMetaTables } from '~/utils/globals';
import TestDbMngr from '../TestDbMngr';

const dropTablesAllNonExternalProjects = async () => {
  const bases = await Base.list({});
  const userCreatedTableNames: string[] = [];
  await Promise.all(
    bases
      .filter((base) => base.is_meta)
      .map(async (base) => {
        await base.getSources();
        const source = base.sources && base.sources[0];
        if (!source) return;

        const models = await Model.list(
          {
            workspace_id: base.fk_workspace_id,
            base_id: base.id,
          },
          {
            base_id: base.id,
            source_id: source.id!,
          },
        );
        models.forEach((model) => {
          userCreatedTableNames.push(model.table_name);
        });
      }),
  );

  await TestDbMngr.disableForeignKeyChecks(TestDbMngr.metaKnex);

  for (const tableName of userCreatedTableNames) {
    if (TestDbMngr.isPg()) {
      await TestDbMngr.metaKnex.raw(`DROP TABLE "${tableName}" CASCADE`);
    } else {
      await TestDbMngr.metaKnex.raw(`DROP TABLE ${tableName}`);
    }
  }

  await TestDbMngr.enableForeignKeyChecks(TestDbMngr.metaKnex);
};

const cleanupMetaTables = async () => {
  await TestDbMngr.disableForeignKeyChecks(TestDbMngr.metaKnex);
  for (const tableName of orderedMetaTables) {
    try {
      await TestDbMngr.metaKnex.raw(`DELETE FROM ${tableName}`);
    } catch (e) {}
  }
  await TestDbMngr.enableForeignKeyChecks(TestDbMngr.metaKnex);
};

export default async function () {
  try {
    await NcConnectionMgrv2.destroyAll();

    await dropTablesAllNonExternalProjects();
    await cleanupMetaTables();
  } catch (e) {
    console.error('cleanupMeta', e);
  }
}
