import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import { AnkiGeneratorResult, GenerateAnkiDeckData } from '../electron.d';
import Tooltip from '@mui/material/Tooltip';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

// Tipos de perguntas possíveis
const QUESTION_TYPES = [
    { id: 'definition', label: 'Definição' },
    { id: 'cause_effect', label: 'Causa e Efeito' },
    { id: 'example', label: 'Exemplo Concreto' },
    { id: 'comparison', label: 'Comparação' },
    { id: 'date_fact', label: 'Data / Fato Histórico' },
    { id: 'true_false', label: 'Verdadeiro ou Falso' },
];

// Modelos Gemini disponíveis
const AVAILABLE_MODELS = [
    { id: 'gemini-1.5-flash-latest', label: 'Gemini 1.5 Flash (Rápido)' },
    { id: 'gemini-1.5-pro-latest', label: 'Gemini 1.5 Pro (Avançado)' },
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (Mais Novo)' },
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Experimental - Pode falhar)' },
];

const DIFFICULTY_LEVELS = [
    { id: 'qualquer', label: 'Qualquer Nível' },
    { id: 'iniciante', label: 'Iniciante' },
    { id: 'intermediario', label: 'Intermediário' },
    { id: 'avancado', label: 'Avançado' },
];

// NOVO: Estilos de Card
const CARD_STYLES = [
    { id: 'padrao', label: 'Padrão' },
    { id: 'minimalista', label: 'Minimalista' },
    { id: 'alto_contraste', label: 'Alto Contraste (Escuro)' },
];

const AnkiGeneratorPage: React.FC = () => {
    // Estados
    const [topic, setTopic] = useState('');
    const [deckName, setDeckName] = useState('');
    const [tags, setTags] = useState('');
    const [selectedTypes, setSelectedTypes] = useState<Record<string, boolean>>(
        QUESTION_TYPES.reduce((acc, type) => ({ ...acc, [type.id]: false }), {})
    );
    const [selectedModel, setSelectedModel] = useState<string>(AVAILABLE_MODELS[0].id);
    const [difficultyLevel, setDifficultyLevel] = useState<string>(DIFFICULTY_LEVELS[0].id);
    const [additionalInstructions, setAdditionalInstructions] = useState('');
    const [approximateCards, setApproximateCards] = useState<number | '' > ('');
    const [cardStyle, setCardStyle] = useState<string>(CARD_STYLES[0].id);
    const [learningSteps, setLearningSteps] = useState<string>('10m 1d');
    const [generatedApkgData, setGeneratedApkgData] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [errorType, setErrorType] = useState<string | null>(null);
    const [showApiKeyInput, setShowApiKeyInput] = useState(false);
    const [tempApiKey, setTempApiKey] = useState('');
    const api = window.electronAPI;

    // Handlers
    const handleTopicChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setTopic(event.target.value);
        if (!deckName) {
            setDeckName(event.target.value);
        }
        setShowApiKeyInput(false);
        setError(null);
        setErrorType(null);
    };

    const handleDeckNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setDeckName(event.target.value);
        setShowApiKeyInput(false);
        setError(null);
        setErrorType(null);
    };

    const handleTagsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setTags(event.target.value.replace(/[^a-zA-Z0-9_\-\s]/g, ''));
        setShowApiKeyInput(false);
        setError(null);
        setErrorType(null);
    };

    const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSelectedTypes({
            ...selectedTypes,
            [event.target.name]: event.target.checked,
        });
        setShowApiKeyInput(false);
        setError(null);
        setErrorType(null);
    };

    const handleModelChange = (event: SelectChangeEvent<string>) => {
        setSelectedModel(event.target.value as string);
        setShowApiKeyInput(false);
        setError(null);
        setErrorType(null);
    };

    const handleDifficultyChange = (event: SelectChangeEvent<string>) => {
        setDifficultyLevel(event.target.value as string);
        setShowApiKeyInput(false);
        setError(null);
        setErrorType(null);
    };

    const handleInstructionsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setAdditionalInstructions(event.target.value);
        setShowApiKeyInput(false);
        setError(null);
        setErrorType(null);
    };

    const handleApproximateCardsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        if (value === '' || (/^\d+$/.test(value) && parseInt(value, 10) >= 0)) {
            setApproximateCards(value === '' ? '' : parseInt(value, 10));
            setShowApiKeyInput(false);
            setError(null);
            setErrorType(null);
        }
    };

    const handleCardStyleChange = (event: SelectChangeEvent<string>) => {
        setCardStyle(event.target.value as string);
        setShowApiKeyInput(false);
        setError(null);
        setErrorType(null);
    };

    const handleLearningStepsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const sanitizedValue = event.target.value.replace(/[^\dsmh\s]/gi, '');
        setLearningSteps(sanitizedValue);
        setShowApiKeyInput(false);
        setError(null);
        setErrorType(null);
    };

    const handleTempApiKeyChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setTempApiKey(event.target.value);
    };

    const processApiResult = (result: AnkiGeneratorResult | undefined) => {
        if (!result) {
            setError('Ocorreu um erro inesperado na comunicação.');
            setErrorType('other');
            setShowApiKeyInput(false);
            setGeneratedApkgData(null);
            return;
        }
        console.log('Processando resultado do IPC:', result);
        if (result.success && result.apkgData) {
            setGeneratedApkgData(result.apkgData);
            setError(null);
            setErrorType(null);
            setShowApiKeyInput(false);
            setTempApiKey('');
        } else {
            setError(result.error || 'Falha desconhecida.');
            setErrorType(result.errorType || 'other');
            setShowApiKeyInput(result.errorType === 'apiKeyMissing' || result.errorType === 'apiKeyInvalid');
            setGeneratedApkgData(null);
        }
    };

    const buildPayload = (): GenerateAnkiDeckData => {
        const payload: GenerateAnkiDeckData = {
            topic,
            deckName: deckName || topic,
            selectedTypes,
            modelId: selectedModel,
        };
        if (tags.trim()) {
            payload.tags = tags.trim().replace(/\s+/g, ' ');
        }
        if (cardStyle !== 'padrao') {
            payload.cardStyle = cardStyle;
        }
        if (learningSteps.trim()) {
            payload.learningSteps = learningSteps.trim().replace(/\s+/g, ' ');
        }
        if (difficultyLevel !== 'qualquer') {
            payload.difficultyLevel = difficultyLevel;
        }
        if (additionalInstructions.trim()) {
            payload.additionalInstructions = additionalInstructions.trim();
        }
        if (approximateCards !== '' && approximateCards > 0) {
            payload.approximateCards = approximateCards;
        }
        return payload;
    };

    const handleGenerateClick = async () => {
        if (!api?.generateAnkiDeck) {
            setError('Erro: Funcionalidade de geração Anki não disponível.');
            setErrorType('other');
            setShowApiKeyInput(false);
            return;
        }
        setError(null);
        setErrorType(null);
        setShowApiKeyInput(false);
        setGeneratedApkgData(null);
        setIsLoading(true);

        try {
            const payload = buildPayload();
            console.log('Enviando para IPC (generateAnkiDeck):', payload);
            const result = await api.generateAnkiDeck(payload);
            processApiResult(result);
        } catch (err: any) {
            console.error("Erro ao chamar generateAnkiDeck:", err);
            setError(err.message || 'Erro de comunicação inesperado.');
            setErrorType('other');
            setShowApiKeyInput(false);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveAndRetry = async () => {
        if (!api?.saveApiKeyAndRetry) {
            setError('Erro: Funcionalidade de salvar chave não disponível.');
            setErrorType('other');
            setShowApiKeyInput(false);
            return;
        }
        if (!tempApiKey) {
            setError('Por favor, insira a chave da API Gemini no campo abaixo.');
            setErrorType('validation');
            return;
        }
        setError(null);
        setErrorType(null);
        setShowApiKeyInput(true);
        setGeneratedApkgData(null);
        setIsLoading(true);

        try {
            const originalData = buildPayload();
            console.log('Enviando para IPC (saveApiKeyAndRetry):', { apiKey: '***', originalData });
            const result = await api.saveApiKeyAndRetry(tempApiKey, originalData);
            processApiResult(result);
        } catch (err: any) {
            console.error("Erro ao chamar saveApiKeyAndRetry:", err);
            setError(err.message || 'Erro de comunicação inesperado ao salvar chave.');
            setErrorType('other');
            setShowApiKeyInput(true);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownloadApkg = () => {
        if (!generatedApkgData) return;

        try {
            const byteCharacters = atob(generatedApkgData);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);

            const blob = new Blob([byteArray], { type: 'application/vnd.anki.package' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            const safeDeckName = (deckName || topic).replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'deck';
            link.setAttribute("download", `deck_ia_${safeDeckName}.apkg`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error("Erro ao decodificar Base64 ou criar Blob:", e);
            setError("Erro ao preparar o arquivo para download.");
            setErrorType('downloadError');
        }
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="h4" gutterBottom>
                Gerador de Deck Anki com IA
            </Typography>

            <Paper elevation={2} sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                    Configuração da Geração
                </Typography>
                <TextField
                    fullWidth
                    label="Tópico para Geração da IA"
                    variant="outlined"
                    value={topic}
                    onChange={handleTopicChange}
                    margin="normal"
                    helperText="O que a IA deve usar como base para criar os cards? Ex: Roma Antiga, Verbos Irregulares em Inglês"
                    disabled={isLoading}
                />
                <TextField
                    fullWidth
                    label="Nome do Deck no Anki"
                    variant="outlined"
                    value={deckName}
                    onChange={handleDeckNameChange}
                    margin="normal"
                    helperText="Como o deck aparecerá no Anki? Pode usar '::' para subdecks (ex: Idiomas::Inglês::Verbos)"
                    disabled={isLoading}
                />
                <TextField
                    fullWidth
                    label="Tags (Opcional)"
                    variant="outlined"
                    value={tags}
                    onChange={handleTagsChange}
                    margin="normal"
                    helperText="Etiquetas separadas por espaço para organizar os cards. Ex: história roma antigo verbs"
                    disabled={isLoading}
                />
                <FormControl fullWidth margin="normal" disabled={isLoading}>
                    <InputLabel id="gemini-model-select-label">Modelo Gemini</InputLabel>
                    <Select
                        labelId="gemini-model-select-label"
                        id="gemini-model-select"
                        value={selectedModel}
                        label="Modelo Gemini"
                        onChange={handleModelChange}
                    >
                        {AVAILABLE_MODELS.map((model) => (
                            <MenuItem key={model.id} value={model.id}>
                                {model.label}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
                <FormControl fullWidth margin="normal" disabled={isLoading}>
                    <InputLabel id="difficulty-level-select-label">Nível de Dificuldade</InputLabel>
                    <Select
                        labelId="difficulty-level-select-label"
                        id="difficulty-level-select"
                        value={difficultyLevel}
                        label="Nível de Dificuldade"
                        onChange={handleDifficultyChange}
                    >
                        {DIFFICULTY_LEVELS.map((level) => (
                            <MenuItem key={level.id} value={level.id}>
                                {level.label}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
                <FormControl fullWidth margin="normal" disabled={isLoading}>
                    <InputLabel id="card-style-select-label">Estilo do Card</InputLabel>
                    <Select
                        labelId="card-style-select-label"
                        id="card-style-select"
                        value={cardStyle}
                        label="Estilo do Card"
                        onChange={handleCardStyleChange}
                    >
                        {CARD_STYLES.map((style) => (
                            <MenuItem key={style.id} value={style.id}>
                                {style.label}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
                <TextField
                    fullWidth
                    label="Passos de Aprendizagem (Opcional)"
                    variant="outlined"
                    value={learningSteps}
                    onChange={handleLearningStepsChange}
                    margin="normal"
                    helperText="Intervalos para novos cards. Ex: 1m 10m 1d (Padrão Anki: 10m 1d)"
                    placeholder="10m 1d"
                    disabled={isLoading}
                    InputProps={{
                        endAdornment: (
                            <Tooltip title="Define os intervalos iniciais antes de um card se tornar de revisão. Use 'm' para minutos, 'h' para horas, 'd' para dias. Ex: 10m 1h 3d">
                                <InfoOutlinedIcon sx={{ color: 'action.active', mr: 0.5 }} />
                            </Tooltip>
                        )
                    }}
                />
                <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>
                    Tipos de Perguntas a Incluir:
                </Typography>
                <FormGroup sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
                    {QUESTION_TYPES.map((type) => (
                        <FormControlLabel
                            key={type.id}
                            control={
                                <Checkbox
                                    checked={selectedTypes[type.id]}
                                    onChange={handleCheckboxChange}
                                    name={type.id}
                                    disabled={isLoading}
                                />
                            }
                            label={type.label}
                        />
                    ))}
                </FormGroup>
                <TextField
                    fullWidth
                    label="Instruções Adicionais para IA (Opcional)"
                    variant="outlined"
                    multiline
                    rows={3}
                    value={additionalInstructions}
                    onChange={handleInstructionsChange}
                    margin="normal"
                    helperText="Ex: Focar em aplicações práticas, incluir datas importantes, evitar jargões técnicos."
                    disabled={isLoading}
                />
                <TextField
                    fullWidth
                    label="Número Aproximado de Cards (Opcional)"
                    variant="outlined"
                    type="number"
                    value={approximateCards}
                    onChange={handleApproximateCardsChange}
                    margin="normal"
                    InputProps={{
                        inputProps: { min: 1, step: 1 }
                    }}
                    helperText="Sugira à IA quantos cards gerar (nem sempre será exato)."
                    disabled={isLoading}
                    sx={{ maxWidth: '250px'}}
                />
                <Button
                    variant="contained"
                    onClick={handleGenerateClick}
                    disabled={isLoading || !topic || !deckName || !Object.values(selectedTypes).some(v => v)}
                    sx={{ mt: 3 }}
                >
                    {isLoading ? <CircularProgress size={24} sx={{ color: 'inherit' }} /> : 'Gerar Deck com Gemini'}
                </Button>
                {error && (
                    <Alert severity={errorType === 'apiKeyMissing' || errorType === 'apiKeyInvalid' ? "warning" : "error"} sx={{ mt: 2, whiteSpace: 'pre-wrap' }}>
                        {error}
                    </Alert>
                )}
                {showApiKeyInput && (
                    <Box sx={{ mt: 2, border: '1px dashed grey', p: 2, borderRadius: 1 }}>
                        <Typography variant="body2" gutterBottom>
                            Parece que a chave da API está faltando ou é inválida. Cole-a abaixo:
                        </Typography>
                        <TextField
                            fullWidth
                            label="Sua Chave API Gemini"
                            variant="outlined"
                            type="password"
                            value={tempApiKey}
                            onChange={handleTempApiKeyChange}
                            margin="dense"
                            disabled={isLoading}
                            size="small"
                        />
                        <Button
                            variant="contained"
                            color="secondary"
                            size="small"
                            onClick={handleSaveAndRetry}
                            disabled={isLoading || !tempApiKey}
                            sx={{ mt: 1 }}
                        >
                            {isLoading ? <CircularProgress size={20} sx={{ color: 'inherit' }}/> : 'Salvar Chave e Tentar Novamente'}
                        </Button>
                    </Box>
                )}
            </Paper>
            {generatedApkgData && !isLoading && (
                 <Paper elevation={2} sx={{ p: 3, mt: 2 }}>
                    <Typography variant="h6" gutterBottom>
                        Deck Gerado!
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 2 }}>
                        Seu arquivo .apkg está pronto para ser importado no Anki.
                    </Typography>
                     <Button
                        variant="contained"
                        color="success"
                        onClick={handleDownloadApkg}
                        sx={{ mt: 1 }}
                        disabled={!generatedApkgData}
                     >
                        Baixar Arquivo .apkg
                     </Button>
                 </Paper>
            )}
        </Box>
    );
};

export default AnkiGeneratorPage; 