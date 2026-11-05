import { MigrationWorkspace } from "@/features/migration";
import { SettingsPage } from "@/features/settings";

export default function SettingsMigrationsPage() {
  return (
    <SettingsPage sectionId="migrations">
      <MigrationWorkspace />
    </SettingsPage>
  );
}
