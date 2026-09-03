// Master Test Runner executing all test suites in obsidian-folder-notes
import './obsidian_mock';

console.log("================================================================================");
console.log("  EXECUTING ALL FOLDER NOTES TEST SUITES                                        ");
console.log("================================================================================");

import './test_folder_note_functions';
import './test_storage_locations';
import './test_settings_and_defaults';
import './test_invariants_and_zero_emoji_audit';

