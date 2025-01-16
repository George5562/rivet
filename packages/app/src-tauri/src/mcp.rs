use std::fs;
use std::path::PathBuf;
use tauri::InvokeError;

#[tauri::command]
pub fn mcp_load_config() -> Result<String, InvokeError> {
    let config_path = PathBuf::from("config.json");
    
    match fs::read_to_string(&config_path) {
        Ok(content) => Ok(content),
        Err(err) => Err(InvokeError::from(format!(
            "Failed to load MCP configuration: {}",
            err
        ))),
    }
} 