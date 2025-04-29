import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfigStore } from '../store/configStore';
import { useSnackbar } from '../context/SnackbarContext';
import { BotConfig, InteractionMode, DetectionMethod } from '../electron.d';

// MUI Imports
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import SendToMobileIcon from '@mui/icons-material/SendToMobile';
import SaveIcon from '@mui/icons-material/Save';
import FileOpenIcon from '@mui/icons-material/FileOpen';
import DeleteIcon from '@mui/icons-material/Delete';
import Tooltip from '@mui/material/Tooltip';
import AddBoxIcon from '@mui/icons-material/AddBox';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';

// Hello Pangea DnD Imports (replaces react-beautiful-dnd)
import {
    DragDropContext,
    Droppable,
    Draggable,
    DropResult,
    DroppableProvided,
    DraggableProvided,
    DraggableStateSnapshot
} from '@hello-pangea/dnd'; // Changed import path

// Define the structure for our draggable items (used for available blocks)
interface AvailableBlockItem {
    id: string; // react-beautiful-dnd requires string IDs
    type: string;
}

// Define the structure for items on the canvas, including their values
interface CanvasBlockItem extends AvailableBlockItem {
    instanceId: string; // Unique ID for this instance on the canvas
    value: any;
}


// --- Components for Draggable Items ---

// Component for items in the source list (side panel)
const AvailableBlock: React.FC<{
    item: AvailableBlockItem;
    index: number;
}> = ({ item, index }) => {
    return (
        <Draggable draggableId={item.id} index={index}>
            {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
                <Paper
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps} // Use whole item as handle for sidebar
                    elevation={snapshot.isDragging ? 4 : 2}
                    sx={(theme) => ({
                        p: 1,
                        mb: 1,
                        display: 'flex',
                        alignItems: 'center',
                        userSelect: 'none', // Prevent text selection during drag
                        backgroundColor: snapshot.isDragging ? theme.palette.action.hover : theme.palette.grey[800], // Changed for dark theme
                        opacity: snapshot.isDragging ? 0.9 : 1,
                        // Add any other dragging styles if needed
                    })}
                >
                    <AddBoxIcon sx={{ mr: 1, color: 'action.active' }} />
                    <ListItemText primary={item.type} />
                </Paper>
            )}
        </Draggable>
    );
};

// Component for items in the target list (canvas)
const CanvasBlock: React.FC<{
    item: CanvasBlockItem;
    index: number;
    onValueChange: (instanceId: string, value: any) => void;
    onRemove: (instanceId: string) => void;
    jsonErrorBlockId: string | null;
}> = ({ item, index, onValueChange, onRemove, jsonErrorBlockId }) => {

    const renderInput = () => {
        const commonProps = {
            value: item.value ?? '',
            onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onValueChange(item.instanceId, e.target.value),
            variant: "outlined" as "outlined",
            size: "small" as "small",
            sx: { mt: 1, width: '100%' }
        };

        switch (item.type) {
            case 'Game':
                const gameOptions = ['Game1', 'Game2', 'Another Game'];
                return (
                    <FormControl fullWidth size="small" sx={{ mt: 1 }}>
                        <InputLabel>Select Game</InputLabel>
                        <Select
                            label="Select Game"
                            value={item.value ?? ''}
                            onChange={(e) => onValueChange(item.instanceId, e.target.value)}
                        >
                            {gameOptions.map(opt => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
                        </Select>
                    </FormControl>
                );
            case 'Script':
                return <TextField label="Script Name" {...commonProps} />;
            case 'Duration':
            case 'Startup Delay':
                 return <TextField label={item.type} type="number" {...commonProps} InputProps={{ inputProps: { min: 0 } }} />;
            case 'Interaction Mode':
                const interactionModes: InteractionMode[] = ['input_simulation', 'memory_read', 'network_intercept'];
                 return (
                    <FormControl fullWidth size="small" sx={{ mt: 1 }}>
                        <InputLabel>Mode</InputLabel>
                        <Select
                            label="Mode"
                            value={item.value ?? ''}
                            onChange={(e) => onValueChange(item.instanceId, e.target.value as InteractionMode)}
                        >
                            {interactionModes.map(opt => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
                        </Select>
                    </FormControl>
                );
            case 'Detection Method':
                 const detectionMethods: DetectionMethod[] = ['log_scan', 'visual_change', 'process_exit'];
                 return (
                    <FormControl fullWidth size="small" sx={{ mt: 1 }}>
                        <InputLabel>Method</InputLabel>
                        <Select
                            label="Method"
                            value={item.value ?? ''}
                            onChange={(e) => onValueChange(item.instanceId, e.target.value as DetectionMethod)}
                        >
                            {detectionMethods.map(opt => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
                        </Select>
                    </FormControl>
                );
            case 'Parameters (JSON)':
                return <TextField
                            label="Parameters (JSON format)"
                            multiline
                            rows={3}
                            {...commonProps}
                            error={item.instanceId === jsonErrorBlockId}
                            helperText={item.instanceId === jsonErrorBlockId ? "Invalid JSON format" : ""}
                       />;
            default:
                return <Typography variant="caption">No input defined for this block type.</Typography>;
        }
    };

    return (
        <Draggable draggableId={item.instanceId} index={index}>
            {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
                <Paper
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    // {...provided.dragHandleProps} // Drag handle is applied below
                    elevation={snapshot.isDragging ? 6 : 3}
                    sx={(theme) => ({ // Pass theme via function
                        p: 2,
                        mb: 1.5,
                        display: 'flex',
                        alignItems: 'flex-start',
                        userSelect: 'none',
                        backgroundColor: theme.palette.grey[800], // Changed for better dark theme contrast
                        border: item.instanceId === jsonErrorBlockId ? '2px solid red' : 'none',
                        position: 'relative',
                        opacity: snapshot.isDragging ? 0.8 : 1,
                    })}
                >
                    {/* Drag Handle */}
                    <Box {...provided.dragHandleProps} sx={{ cursor: 'grab', mr: 1.5, pt: '4px', display: 'inline-flex' }}>
                         <DragIndicatorIcon sx={{ color: 'action.active' }} />
                    </Box>
                    {/* Block Content */}
                    <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="subtitle1">{item.type}</Typography>
                        {renderInput()}
                    </Box>
                     {/* Remove Button */}
                     <IconButton
                         onClick={() => onRemove(item.instanceId)}
                         size="small"
                         sx={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            color: 'action.active',
                            '&:hover': { color: 'error.main' },
                         }}
                         aria-label="Remove block"
                     >
                         <DeleteIcon fontSize="small" />
                     </IconButton>
                </Paper>
            )}
        </Draggable>
    );
};


// --- Utility Functions ---

const isValidJson = (str: string): boolean => {
    if (!str?.trim()) return true;
    try {
        JSON.parse(str);
        return true;
    } catch (e) {
        return false;
    }
};

// Helper to reorder lists for react-beautiful-dnd
const reorder = <TList extends unknown[]>(list: TList, startIndex: number, endIndex: number): TList => {
    const result = Array.from(list);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    return result as TList;
};


const buildConfigFromCanvas = (
    configName: string,
    blocks: CanvasBlockItem[]
): { config: BotConfig | null; error?: string, errorBlockId?: string } => { // errorBlockId is now string
    if (!configName) {
        return { config: null, error: 'Configuration Name is required.' };
    }

    const config: Partial<BotConfig> = { name: configName };
    let error: string | undefined = undefined;
    let errorBlockId: string | undefined = undefined; // Changed to string
    const usedTypes = new Set<string>();

    for (const block of blocks) {
        const blockType = block.type;
        const blockValue = block.value;

        const singleInstanceTypes = ['Game', 'Script', 'Duration', 'Startup Delay', 'Interaction Mode', 'Detection Method', 'Parameters (JSON)'];
        if (singleInstanceTypes.includes(blockType)) {
            if (usedTypes.has(blockType)) {
                 console.warn(`Duplicate block type found: ${blockType}. Using the first instance.`);
                 continue;
            }
            usedTypes.add(blockType);
        }

        switch (blockType) {
            case 'Game':
                if (!blockValue) return { config: null, error: `'${blockType}' block requires a selection.` };
                config.game = blockValue;
                break;
            case 'Script':
                 if (!blockValue) return { config: null, error: `'${blockType}' block requires a name.` };
                config.script = blockValue;
                break;
            case 'Duration':
                const duration = parseInt(blockValue, 10);
                if (blockValue === null || blockValue === undefined || isNaN(duration) || duration < 0) return { config: null, error: `'${blockType}' must be a non-negative number.` };
                config.durationMinutes = duration;
                break;
            case 'Startup Delay':
                 const delay = parseInt(blockValue, 10);
                 if (blockValue === null || blockValue === undefined || isNaN(delay) || delay < 0) return { config: null, error: `'${blockType}' must be a non-negative number.` };
                config.startupDelaySeconds = delay;
                break;
            case 'Interaction Mode':
                 if (!blockValue) return { config: null, error: `'${blockType}' block requires a selection.` };
                config.interactionMode = blockValue as InteractionMode;
                break;
            case 'Detection Method':
                 if (!blockValue) return { config: null, error: `'${blockType}' block requires a selection.` };
                config.detectionMethod = blockValue as DetectionMethod;
                break;
            case 'Parameters (JSON)':
                if (blockValue && !isValidJson(blockValue)) {
                    return { config: null, error: `'${blockType}' block contains invalid JSON.`, errorBlockId: block.instanceId }; // Use instanceId
                }
                try {
                     config.params = (blockValue && blockValue.trim()) ? JSON.parse(blockValue) : undefined;
                } catch {
                     return { config: null, error: `Error parsing '${blockType}' JSON.`, errorBlockId: block.instanceId }; // Use instanceId
                }
                break;
            default:
                console.warn(`Unknown block type encountered during parsing: ${blockType}`);
        }
    }

    if (!config.game && !config.script) {
        // Allow for now
    }

    return { config: config as BotConfig, error, errorBlockId };
};


// --- Main Page Component ---

const ConfigBuilderPage: React.FC = () => {
    const navigate = useNavigate();
    const { showSnackbar } = useSnackbar();
    const setActiveConfig = useConfigStore((state) => state.setActiveConfig);
    const api = window.electronAPI;

    const [configName, setConfigName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingFile, setIsLoadingFile] = useState(false);
    const [jsonErrorBlockId, setJsonErrorBlockId] = useState<string | null>(null); // Changed to string

    // Available blocks in the side panel
    const initialAvailableBlocks: AvailableBlockItem[] = [
        { id: 'game', type: 'Game' },
        { id: 'script', type: 'Script' },
        { id: 'duration', type: 'Duration' },
        { id: 'startupDelay', type: 'Startup Delay' },
        { id: 'interactionMode', type: 'Interaction Mode' },
        { id: 'detectionMethod', type: 'Detection Method' },
        { id: 'params', type: 'Parameters (JSON)' },
    ];
    // Note: We don't modify availableBlocks state, it's static
    const [availableBlocks] = useState<AvailableBlockItem[]>(initialAvailableBlocks);

    // Blocks currently on the canvas
    const [canvasBlocks, setCanvasBlocks] = useState<CanvasBlockItem[]>([]);

    // Handler to update the value of a specific block on the canvas
    const handleBlockValueChange = useCallback((instanceId: string, newValue: any) => {
        setCanvasBlocks(prevBlocks =>
            prevBlocks.map(block =>
                block.instanceId === instanceId ? { ...block, value: newValue } : block
            )
        );
        if (instanceId === jsonErrorBlockId) {
            setJsonErrorBlockId(null);
        }
    }, [jsonErrorBlockId]);

    // Add remove block handler
    const handleRemoveBlock = useCallback((instanceIdToRemove: string) => {
        setCanvasBlocks(prev => prev.filter(block => block.instanceId !== instanceIdToRemove));
        if (instanceIdToRemove === jsonErrorBlockId) {
            setJsonErrorBlockId(null);
        }
    }, [jsonErrorBlockId]);


    // --- react-beautiful-dnd Drag End Handler ---
    const onDragEnd = (result: DropResult) => {
        const { source, destination, draggableId } = result;

        // Dropped outside any droppable area
        if (!destination) {
            return;
        }

        // Dropped in the same place
        if (
            destination.droppableId === source.droppableId &&
            destination.index === source.index
        ) {
            return;
        }

        // --- Reordering within the Canvas ---
        if (source.droppableId === 'canvas-area' && destination.droppableId === 'canvas-area') {
            const reorderedBlocks = reorder(
                canvasBlocks,
                source.index,
                destination.index
            );
            setCanvasBlocks(reorderedBlocks);
        }
        // --- Dragging from Sidebar to Canvas ---
        else if (source.droppableId === 'available-blocks' && destination.droppableId === 'canvas-area') {
            // Find the original block type from the available list
            const sourceBlock = availableBlocks.find(block => block.id === draggableId);
            if (!sourceBlock) return; // Should not happen

            // Create a new instance for the canvas
            const newCanvasBlock: CanvasBlockItem = {
                id: sourceBlock.id, // Keep original type ID
                instanceId: `${sourceBlock.id}-${Date.now()}`, // Create unique instance ID
                type: sourceBlock.type,
                value: null, // Initialize value
            };

            // Insert the new block into the canvas list at the destination index
            const newCanvasList = Array.from(canvasBlocks);
            newCanvasList.splice(destination.index, 0, newCanvasBlock);
            setCanvasBlocks(newCanvasList);
            setJsonErrorBlockId(null); // Clear errors when adding
        }

        // Other scenarios (e.g., dragging from canvas to sidebar) are ignored
    };


    // Function to populate canvas from a loaded config
    const loadConfigToCanvas = (loadedConfig: BotConfig) => {
        const newCanvasBlocks: CanvasBlockItem[] = [];
        const timestamp = Date.now();

        const addBlock = (type: string, idBase: string, value: any) => {
             const configKey = idBase === 'duration' ? 'durationMinutes'
                             : idBase === 'startupDelay' ? 'startupDelaySeconds'
                             : idBase === 'params' ? 'params'
                             : idBase;

            if (Object.prototype.hasOwnProperty.call(loadedConfig, configKey)) {
                 let processedValue = value;
                 if (type === 'Parameters (JSON)' && value !== undefined && value !== null) {
                     try {
                         processedValue = JSON.stringify(value, null, 2);
                     } catch (e) {
                         console.error(`Error stringifying loaded params for ${idBase}:`, e);
                         showSnackbar(`Failed to stringify parameters for ${type} from loaded file.`, 'error');
                         processedValue = "{}";
                     }
                 }

                newCanvasBlocks.push({
                    id: idBase, // Original type ID
                    instanceId: `${idBase}-${timestamp}-${newCanvasBlocks.length}`, // Unique instance ID
                    type: type,
                    value: processedValue,
                });
            }
        };

        setConfigName(loadedConfig.name || '');

        // Map available block types to config fields and add them
        // Ensure the 'type' and 'idBase' match the definitions in initialAvailableBlocks
        addBlock('Game', 'game', loadedConfig.game);
        addBlock('Script', 'script', loadedConfig.script);
        addBlock('Duration', 'duration', loadedConfig.durationMinutes);
        addBlock('Startup Delay', 'startupDelay', loadedConfig.startupDelaySeconds);
        addBlock('Interaction Mode', 'interactionMode', loadedConfig.interactionMode);
        addBlock('Detection Method', 'detectionMethod', loadedConfig.detectionMethod);
        addBlock('Parameters (JSON)', 'params', loadedConfig.params);

        setCanvasBlocks(newCanvasBlocks);
        setJsonErrorBlockId(null);
        showSnackbar('Configuration loaded successfully.', 'success');
    };


    // --- Action Handlers (Unchanged) ---

    const handleSendToControlPanel = () => {
        setJsonErrorBlockId(null);
        const { config, error, errorBlockId } = buildConfigFromCanvas(configName, canvasBlocks);

        if (error) {
            showSnackbar(error, 'error');
            if (errorBlockId) {
                setJsonErrorBlockId(errorBlockId);
            }
            return;
        }

        if (config) {
            console.log("Sending config:", config);
            setActiveConfig(config);
            showSnackbar(`Configuration "${config.name}" set as active.`, 'success');
            navigate('/bot-control');
        } else {
            showSnackbar('Failed to build configuration.', 'error');
        }
    };

    const handleSaveToFile = async () => {
        setJsonErrorBlockId(null);
        const { config, error, errorBlockId } = buildConfigFromCanvas(configName, canvasBlocks);

        if (error) {
            showSnackbar(error, 'error');
             if (errorBlockId) {
                setJsonErrorBlockId(errorBlockId);
            }
            return;
        }

        if (!config) {
             showSnackbar('Cannot save - configuration is incomplete or invalid.', 'warning');
             return;
        }

        setIsSaving(true);
        try {
            const defaultName = config.name ? `${config.name}.json` : 'bot_config.json';
            const result = await api.saveFileDialog(JSON.stringify(config, null, 2), defaultName);
            if (result.success && result.filePath) {
                showSnackbar(`Configuration saved to ${result.filePath}`, 'success');
            } else if (!result.canceled && result.error) {
                showSnackbar(result.error, 'error');
            } else if (!result.canceled) {
                 showSnackbar('Failed to save file (unknown reason).', 'error');
            }
        } catch (err: any) {
            console.error("Save file error:", err);
            showSnackbar(err.message || 'An error occurred during save.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleLoadFromFile = async () => {
        setIsLoadingFile(true);
        setJsonErrorBlockId(null);
        setCanvasBlocks([]);
        setConfigName('');
        try {
            const result = await api.openFileDialog();
            if (result.success && result.content) {
                try {
                    const loadedConfig = JSON.parse(result.content) as BotConfig;
                    if (typeof loadedConfig !== 'object' || loadedConfig === null) {
                         throw new Error("Invalid configuration file structure (not an object).");
                    }
                    if (!loadedConfig.name && !loadedConfig.game && !loadedConfig.script && !loadedConfig.params) {
                         console.warn("Loaded config seems empty or lacks key fields.");
                    }
                    loadConfigToCanvas(loadedConfig);
                } catch (parseError: any) {
                    console.error("Load file parse error:", parseError);
                    showSnackbar(`Failed to parse JSON file: ${parseError.message}`, 'error');
                }
            } else if (result.error) {
                showSnackbar(result.error, 'error');
            }
        } catch (err: any) {
            console.error("Load file error:", err);
            showSnackbar(err.message || 'An error occurred during load.', 'error');
        } finally {
            setIsLoadingFile(false);
        }
    };


    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <Box sx={{ p: 2 }}>
                <Typography variant="h4" gutterBottom> Visual Config Builder </Typography>
                <Box display="flex" gap={3} sx={{ flexDirection: { xs: 'column', md: 'row' }, overflowX: 'hidden' }}> {/* Keep overflow hidden on main flex container */}
                    {/* --- Side Panel (Available Blocks) --- */}
                    <Box sx={{ width: { xs: '100%', md: '25%' } }}>
                        <Paper elevation={1} sx={{ p: 2, height: { xs: 'auto', md: 'calc(100vh - 200px)' }, overflowY: 'auto' }}>
                            <Typography variant="h6" gutterBottom>Available Blocks</Typography>
                            <Divider sx={{ mb: 2 }} />
                            <Droppable droppableId="available-blocks" isDropDisabled={true}>
                                {(provided: DroppableProvided) => (
                                    <List
                                        dense
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                    >
                                        {availableBlocks.map((item, index) => (
                                            <AvailableBlock key={item.id} item={item} index={index} />
                                        ))}
                                        {provided.placeholder} {/* Important for spacing */}
                                    </List>
                                )}
                            </Droppable>
                        </Paper>
                    </Box>

                    {/* --- Canvas Area (Dropped Blocks) --- */}
                    <Box sx={{ width: { xs: '100%', md: '75%' }, display: 'flex', flexDirection: 'column' }}>
                         <TextField
                            fullWidth
                            label="Configuration Name (Required)"
                            variant="outlined"
                            value={configName}
                            onChange={(e) => setConfigName(e.target.value)}
                            size="small"
                            sx={{ mb: 2 }}
                         />
                        <Paper
                            elevation={1}
                            sx={(theme) => ({
                                p: 3,
                                minHeight: 'calc(100vh - 250px)',
                                backgroundColor: 'background.paper',
                                border: `2px dashed ${theme.palette.divider}`,
                                display: 'flex',
                                flexDirection: 'column',
                            })}
                        >
                            <Typography variant="subtitle1" sx={{ mb: 2, color: 'text.secondary', textAlign: 'center' }}>
                                Drag blocks here to build configuration
                            </Typography>
                            <Droppable droppableId="canvas-area">
                                {(provided: DroppableProvided, snapshot) => (
                                    <Box
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        sx={{
                                            flexGrow: 1,
                                            backgroundColor: snapshot.isDraggingOver ? 'action.focus' : 'transparent', // Highlight drop zone
                                            transition: 'background-color 0.2s ease',
                                            borderRadius: 1, // Optional: match paper radius
                                        }}
                                    >
                                        {canvasBlocks.length > 0 ? (
                                            canvasBlocks.map((item, index) => (
                                                <CanvasBlock
                                                    key={item.instanceId} // Use unique instanceId for key
                                                    item={item}
                                                    index={index}
                                                    onValueChange={handleBlockValueChange}
                                                    onRemove={handleRemoveBlock}
                                                    jsonErrorBlockId={jsonErrorBlockId}
                                                />
                                            ))
                                        ) : (
                                            !snapshot.isDraggingOver && ( // Only show if not dragging over
                                                <Box sx={{ textAlign: 'center', color: 'text.disabled', mt: 4, p: 2 }}>
                                                    <Typography>Canvas is empty</Typography>
                                                </Box>
                                            )
                                        )}
                                        {provided.placeholder} {/* Important for spacing */}
                                    </Box>
                                )}
                            </Droppable>
                        </Paper>
                    </Box>
                </Box>

                 {/* --- Action Buttons --- */}
                 <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, flexWrap: 'wrap', mt: 3 }}>
                     <Tooltip title="Load configuration from a .json file">
                         <span>
                             <Button
                                 variant="outlined"
                                 startIcon={<FileOpenIcon />}
                                 onClick={handleLoadFromFile}
                                 disabled={isLoadingFile || isSaving}
                                 sx={{ borderColor: 'primary.main', color: 'primary.main', '&:hover': { borderColor: 'primary.dark', backgroundColor: 'action.hover' } }}
                             >
                                 Load from File
                             </Button>
                         </span>
                     </Tooltip>
                     <Tooltip title={!configName ? "Enter a Configuration Name first" : canvasBlocks.length === 0 ? "Add blocks to the canvas first" : "Save this configuration layout to a .json file"}>
                         <span>
                             <Button
                                 variant="outlined"
                                 startIcon={<SaveIcon />}
                                 onClick={handleSaveToFile}
                                 disabled={isLoadingFile || isSaving || canvasBlocks.length === 0 || !configName}
                                 sx={{ borderColor: 'primary.main', color: 'primary.main', '&:hover': { borderColor: 'primary.dark', backgroundColor: 'action.hover' } }}
                             >
                                 Save to File
                             </Button>
                         </span>
                     </Tooltip>
                     <Tooltip title={!configName ? "Enter a Configuration Name first" : canvasBlocks.length === 0 ? "Add blocks to the canvas first" : "Parse and use this configuration in the Bot Control page"}>
                         <span>
                             <Button
                                 variant="contained"
                                 color="primary"
                                 startIcon={<SendToMobileIcon />}
                                 onClick={handleSendToControlPanel}
                                 disabled={isLoadingFile || isSaving || canvasBlocks.length === 0 || !configName}
                                 sx={{ backgroundColor: 'primary.main', color: 'primary.contrastText', '&:hover': { backgroundColor: 'primary.dark' } }}
                             >
                                 Send to Control
                             </Button>
                         </span>
                     </Tooltip>
                 </Box>
            </Box>
        </DragDropContext>
    );
};

export default ConfigBuilderPage;
