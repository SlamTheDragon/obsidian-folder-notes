// Master Test Runner executing all test suites in obsidian-folder-notes
import './obsidian_mock';

console.log("================================================================================");
console.log("  EXECUTING ALL FOLDER NOTES TEST SUITES                                        ");
console.log("================================================================================");

async function runAll() {
	await import('./test_folder_note_functions.test');
	await import('./test_folder_note_resolver.test');
	await import('./test_storage_locations.test');
	await import('./test_settings_and_defaults.test');
	await import('./test_exclude_service.test');
	await import('./test_exclude_service_bugs.test');
	await import('./test_resolver_escaped_regex.test');
	await import('./test_overview_logic.test');
	await import('./test_link_list_service.test');
	await import('./test_overview_index_service.test');
	await import('./test_vault_write_queue.test');
	await import('./test_invariants_and_zero_emoji_audit.test');
}

void runAll();

