# Especificação de Comunicação: GUI (Electron) <-> Bot Externo

## Visão Geral

Este documento detalha a interface de comunicação e o protocolo a serem utilizados entre a aplicação GUI principal (desenvolvida em Electron/React) e o processo do bot externo. A comunicação é bidirecional e baseada na troca de mensagens JSON via `stdin`, `stdout` e `stderr` do processo do bot.

## Protocolo de Comunicação

1.  **Inicialização:** A GUI é responsável por iniciar o processo executável do bot usando `child_process.spawn`.
2.  **Canais:**
    *   **GUI -> Bot:** A GUI envia comandos para o bot escrevendo strings JSON (uma por linha, terminada por `\n`) no `stdin` do processo do bot.
    *   **Bot -> GUI (Dados Estruturados):** O bot envia atualizações de status, logs, resultados e progresso para a GUI escrevendo strings JSON (uma por linha, terminada por `\n`) no seu `stdout`. A GUI parseará cada linha recebida como um objeto JSON individual.
    *   **Bot -> GUI (Erros/Logs Brutos):** O bot pode usar seu `stderr` para enviar mensagens de erro não estruturadas ou logs de depuração de baixo nível. A GUI capturará essas mensagens e as exibirá como logs de erro.

## Mensagens da GUI para o Bot (`stdin`)

Toda mensagem enviada da GUI para o `stdin` do bot deve ser um objeto JSON válido em uma única linha, com a seguinte estrutura base:

```json
{
  "command": "nome_do_comando",
  "payload": { ...dados específicos do comando... }
}
```

### Comandos Suportados

1.  **`configure` (Opcional, se necessário para o bot):**
    *   Usado para enviar configurações iniciais antes de iniciar tarefas.
    *   `command`: `"configure"`
    *   `payload`: Objeto com os parâmetros de configuração necessários para o bot.
        ```json
        {
          "command": "configure",
          "payload": {
            "setting1": "value1",
            "max_retries": 3
          }
        }
        ```

2.  **`start` (Opcional, se o bot tiver um estado "parado" vs "rodando"):**
    *   Inicia a execução principal ou o monitoramento do bot.
    *   `command`: `"start"`
    *   `payload`: Pode incluir um `run_id` para identificar a sessão de execução.
        ```json
        {
          "command": "start",
          "payload": {
            "run_id": "run_xyz_789"
          }
        }
        ```

3.  **`stop`:**
    *   Solicita que o bot encerre suas operações atuais graciosamente e finalize o processo. O bot deve tentar completar tarefas pendentes ou salvar seu estado antes de sair.
    *   `command`: `"stop"`
    *   `payload`: `{}` (geralmente vazio)
        ```json
        {
          "command": "stop",
          "payload": {}
        }
        ```

4.  **`execute_sequence` (Novo Comando de Macro):**
    *   Instrui o bot a executar uma sequência pré-definida de ações (macro).
    *   `command`: `"execute_sequence"`
    *   `payload`:
        *   `run_id`: (Obrigatório) String única para identificar esta execução específica da sequência.
        *   `sequence`: (Obrigatório) Array de objetos, onde cada objeto representa um passo na sequência.
        *   `initial_variables`: (Opcional) Objeto com valores iniciais para variáveis usadas na sequência (ex: `{ "n": 1, "x": 5 }`).

    **Estrutura dos Passos da Sequência (`sequence` array):**

    Cada objeto no array `sequence` deve ter:
    *   `action`: (Obrigatório) String identificando a ação a ser executada (ex: `"open_chat"`, `"type_text"`, `"increment_variable"`, `"loop"`).
    *   `params`: (Opcional) Objeto contendo parâmetros específicos para a `action`. Pode referenciar variáveis gerenciadas pelo bot (veja abaixo).

    **Exemplo de `payload` para `execute_sequence`:**

    ```json
    {
      "command": "execute_sequence",
      "payload": {
        "run_id": "macro_process_numbers",
        "initial_variables": {
          "n": 1,
          "x": 3,
          "chat_target": "support_team"
        },
        "sequence": [
          { "action": "open_chat", "params": { "target_variable": "chat_target" } }, // Usa variável
          {
            "action": "loop",
            "params": { "times_variable": "x" }, // Loop 'x' vezes
            "block": [ // Comandos dentro do loop
              { "action": "type_number_long", "params": { "variable": "n" } }, // Digita o valor de 'n'
              { "action": "send_message" },
              { "action": "wait", "params": { "duration_ms": 500 } }, // Espera 500ms
              { "action": "increment_variable", "params": { "variable": "n", "amount": 1 } } // n = n + 1
            ]
          },
          { "action": "type_text", "params": { "text": "Sequência concluída." } },
          { "action": "send_message" }
        ]
      }
    }
    ```

    **Considerações para o Bot sobre Sequências:**
    *   **Estado Interno:** O bot *precisa* manter um estado interno para as variáveis (`n`, `x`, `chat_target` no exemplo) durante a execução de uma `run_id`.
    *   **Interpretação:** O bot é responsável por parsear o array `sequence` e executar as `action`s na ordem correta, manipulando variáveis e estruturas de controle (como `loop`).
    *   **Ações Definidas:** A lista exata de `action`s suportadas e seus `params` precisa ser definida e documentada pelo desenvolvedor do bot. Exemplos: `open_chat`, `type_text`, `type_variable`, `click_element`, `wait`, `increment_variable`, `set_variable`, `loop`, `if_condition` (mais complexo), etc.
    *   **Robustez:** O bot deve lidar com erros durante a execução de um passo (ex: elemento não encontrado para `click_element`) e reportar via `stdout` (veja abaixo).

## Mensagens do Bot para a GUI (`stdout`)

Toda mensagem enviada do bot para a `stdout` da GUI deve ser um objeto JSON válido em uma única linha, com a seguinte estrutura base:

```json
{
  "type": "tipo_da_mensagem",
  "payload": { ...dados específicos do tipo... }
}
```

### Tipos de Mensagem Suportados (`type`)

1.  **`status_update`:**
    *   Informa o estado geral do bot.
    *   `payload`:
        *   `state`: String representando o estado atual (ex: `"idle"`, `"initializing"`, `"running_command"`, `"running_sequence"`, `"stopping"`, `"error"`).
        *   `details`: (Opcional) String com informações adicionais sobre o estado.
        ```json
        {"type": "status_update", "payload": {"state": "running_sequence", "details": "Executing step 3 of sequence macro_process_numbers"}}
        ```

2.  **`log`:**
    *   Para enviar mensagens de log formatadas para exibição na GUI.
    *   `payload`:
        *   `level`: String indicando o nível do log (`"info"`, `"warn"`, `"error"`, `"debug"`).
        *   `timestamp`: String ISO 8601 da hora do log.
        *   `message`: String da mensagem de log.
        ```json
        {"type": "log", "payload": {"level": "info", "timestamp": "2024-05-17T10:30:00Z", "message": "Variable 'n' incremented to 4"}}
        ```

3.  **`sequence_progress` (Específico para `execute_sequence`):**
    *   Informa o progresso durante a execução de uma sequência. *Recomendado* para feedback ao usuário.
    *   `payload`:
        *   `run_id`: String identificando a sequência em execução.
        *   `current_step_index`: (Opcional) Índice (base 0) do passo atual no array `sequence`.
        *   `current_action`: (Opcional) A string `action` do passo atual.
        *   `total_steps`: (Opcional) Número total de passos *de nível superior* na sequência (pode não contar passos dentro de loops).
        *   `variables`: (Opcional) Objeto mostrando o estado atual das variáveis da sequência (para debug ou UI).
        *   `message`: (Opcional) Mensagem descritiva sobre o progresso (ex: "Iniciando loop", "Aguardando 500ms").
        ```json
        {"type": "sequence_progress", "payload": {"run_id": "macro_process_numbers", "current_step_index": 3, "current_action": "send_message", "total_steps": 4, "message": "Enviando mensagem...", "variables": {"n": 2, "x": 3, "chat_target": "support_team"}}}
        ```

4.  **`result`:**
    *   Enviado ao final da execução de um comando principal (como `execute_sequence` ou `start` se for uma tarefa longa).
    *   `payload`:
        *   `run_id`: String identificando a execução que terminou (se aplicável, obrigatório para `execute_sequence`).
        *   `outcome`: String indicando o resultado (`"completed"`, `"stopped"`, `"error"`).
        *   `summary`: (Opcional) String ou objeto com um resumo do resultado.
        *   `error_details`: (Opcional) String com detalhes do erro, se `outcome` for `"error"`.
        ```json
        {"type": "result", "payload": {"run_id": "macro_process_numbers", "outcome": "completed", "summary": "Sequence executed successfully in 5.2 seconds"}}
        ```
        ```json
        {"type": "result", "payload": {"run_id": "macro_process_numbers", "outcome": "error", "error_details": "Action 'click_element' failed: Element '#submit_button' not found."}}
        ```

## Mensagens de Erro do Bot (`stderr`)

*   Qualquer saída no `stderr` será tratada pela GUI como uma mensagem de erro bruta.
*   Deve ser usado para erros inesperados, exceções não tratadas no bot, ou logs de depuração que não se encaixam na estrutura JSON do `stdout`.
*   Exemplo: `[ERROR] BotProcess - Failed to initialize network module.`

## Exemplo de Fluxo Completo (Executando Sequência)

1.  **GUI -> Bot (`stdin`)**:
    ```json
    {"command": "execute_sequence", "payload": {"run_id": "seq_abc", "initial_variables": {"n": 1}, "sequence": [{"action": "increment_variable", "params": {"variable": "n", "amount": 1}}, {"action": "wait", "params": {"duration_ms": 100}}]}}
    ```
2.  **Bot -> GUI (`stdout`)**:
    ```json
    {"type": "status_update", "payload": {"state": "running_sequence", "details": "Starting seq_abc"}}
    ```
3.  **Bot -> GUI (`stdout`)**:
    ```json
    {"type": "sequence_progress", "payload": {"run_id": "seq_abc", "current_step_index": 0, "current_action": "increment_variable", "total_steps": 2, "variables": {"n": 1}}}
    ```
4.  **Bot -> GUI (`stdout`)**:
    ```json
    {"type": "log", "payload": {"level": "debug", "timestamp": "...", "message": "Executing increment_variable for 'n'"}}
    ```
5.  **Bot -> GUI (`stdout`)**:
    ```json
    {"type": "sequence_progress", "payload": {"run_id": "seq_abc", "current_step_index": 1, "current_action": "wait", "total_steps": 2, "variables": {"n": 2}}}
    ```
6.  **Bot -> GUI (`stdout`)**:
    ```json
    {"type": "log", "payload": {"level": "debug", "timestamp": "...", "message": "Waiting for 100ms"}}
    ```
7.  **Bot -> GUI (`stdout`)**:
    ```json
    {"type": "result", "payload": {"run_id": "seq_abc", "outcome": "completed"}}
    ```
8.  **Bot -> GUI (`stdout`)**:
    ```json
    {"type": "status_update", "payload": {"state": "idle"}}
    ```

## Considerações Importantes para o Desenvolvedor do Bot

*   **Parse JSON por Linha:** Certifique-se de que cada mensagem JSON enviada para `stdout` termine com `\n` e seja um JSON completo e válido em si. A GUI processará `stdout` linha por linha.
*   **Flush do `stdout`:** Dependendo da linguagem/ambiente do bot, pode ser necessário garantir que `stdout` seja "flushed" após cada escrita de linha JSON para que a GUI receba as mensagens em tempo real.
*   **Tratamento de Erros Internos:** Implemente tratamento de erros robusto dentro do bot. Erros durante a execução de uma sequência devem ser reportados via mensagem `result` com `outcome: "error"`. Erros fatais que impedem o bot de continuar podem usar `stderr`.
*   **Lista de Ações (`action`):** Documente claramente todas as `action`s que o bot suporta para sequências, incluindo os `params` esperados e o comportamento de cada uma.
*   **Concorrência:** Inicialmente, assuma que o bot processará apenas uma `execute_sequence` por vez. Se for necessário paralelismo, o protocolo precisará ser estendido.
*   **Segurança:** Tenha extrema cautela se alguma `action` permitir interações com o sistema operacional ou outros aplicativos. Valide rigorosamente os parâmetros.
