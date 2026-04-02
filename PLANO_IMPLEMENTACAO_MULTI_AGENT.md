# Plano de Implementação — Multi-Agent para NETZ
## Para: Codex (IA Developer)

---

## 📋 Visão Geral

Este plano decompõe a implementação de um sistema multi-agent robusto em **4 fases**, com **tarefas hierárquicas**, **subtarefas**, **arquivos a criar/modificar** e **testes**.

**Duração:** 8 semanas  
**Stack:** Python 3.11 + FastAPI + React 19 + TypeScript  
**Objetivo:** Criar sistema de agentes NETZ que se comunicam, delegam tarefas e orquestram workflows

---

## 🎯 Fase 1: Base de Agentes (Semanas 1-2)

### 1.0 Preparação e Setup
- [ ] 1.1 Criar branch `feature/multi-agent-base`
- [ ] 1.2 Instalar dependências: `pip install fastapi pydantic asyncio redis`
- [ ] 1.3 Criar estrutura de pastas backend
- [ ] 1.4 Criar estrutura de pastas frontend

**Arquivos a criar (Backend):**
```
server/
├── agents/
│   ├── __init__.py
│   ├── base_agent.py           # Classe base de agentes
│   ├── netz_agent.py           # Agente NETZ específico
│   ├── agent_manager.py        # Gerenciador de agentes
│   ├── agent_registry.py       # Registro de agentes
│   ├── agent_types.py          # Tipos e enums
│   └── agent_factory.py        # Factory para criar agentes
├── tools/
│   ├── __init__.py
│   ├── base_tool.py            # Classe base de ferramentas
│   ├── task_tool.py            # Ferramenta de tarefas
│   ├── communication_tool.py   # Ferramenta de comunicação
│   └── tool_registry.py        # Registro de ferramentas
├── communication/
│   ├── __init__.py
│   ├── message_types.py        # Tipos de mensagens
│   ├── message_queue.py        # Fila de mensagens
│   └── message_protocol.py     # Protocolo de mensagens
├── memory/
│   ├── __init__.py
│   ├── conversation_memory.py  # Memória de conversas
│   ├── agent_memory.py         # Memória do agente
│   └── shared_context.py       # Contexto compartilhado
└── tests/
    ├── test_agents.py
    ├── test_tools.py
    └── test_communication.py
```

**Arquivos a criar (Frontend):**
```
client/src/
├── components/MultiAgent/
│   ├── AgentList.tsx           # Lista de agentes
│   ├── AgentDetail.tsx         # Detalhes do agente
│   ├── AgentTools.tsx          # Ferramentas do agente
│   ├── AgentMemory.tsx         # Memória/histórico
│   └── MultiAgent.test.tsx
├── services/
│   ├── agentService.ts         # Serviço de agentes
│   └── agentService.test.ts
└── hooks/
    ├── useAgent.ts             # Hook de agente
    └── useAgent.test.ts
```

---

### 1.1 Implementar Tipos de Agentes

**Arquivo:** `server/agents/agent_types.py`

```python
from enum import Enum
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from datetime import datetime

class AlaType(str, Enum):
    TECNOLOGIA = "Tecnologia"
    NEGOCIOS = "Negocios"
    OPERACOES = "Operacoes"
    SEGURANCA = "Seguranca"

class AgentStatus(str, Enum):
    IDLE = "idle"
    THINKING = "thinking"
    EXECUTING = "executing"
    WAITING = "waiting"
    ERROR = "error"

class Tool(BaseModel):
    id: str
    name: str
    description: str
    capabilities: List[str]
    parameters: Dict[str, Any]
    
    async def execute(self, **kwargs) -> Any:
        raise NotImplementedError

class Message(BaseModel):
    id: str
    from_agent: str
    to_agent: str
    content: str
    message_type: str  # 'task', 'question', 'delegation', 'response'
    timestamp: datetime
    metadata: Dict[str, Any] = {}

class AgentConfig(BaseModel):
    name: str
    ala: AlaType
    expertise: str
    role_description: str
    tools: List[str]
    max_memory_messages: int = 100
    model: str = "gpt-4o-mini"

class AgentState(BaseModel):
    agent_id: str
    status: AgentStatus
    current_task: Optional[str]
    memory_size: int
    tools_count: int
    last_activity: datetime
```

**Testes:**
```python
# server/tests/test_agents.py
import pytest
from agents.agent_types import AlaType, AgentStatus, AgentConfig

def test_agent_config_creation():
    config = AgentConfig(
        name="Mintzie",
        ala=AlaType.TECNOLOGIA,
        expertise="Coordenação e Gestão",
        role_description="Guardião Cultural",
        tools=["task_management", "communication"]
    )
    assert config.name == "Mintzie"
    assert config.ala == AlaType.TECNOLOGIA

def test_agent_status_enum():
    assert AgentStatus.IDLE.value == "idle"
    assert AgentStatus.EXECUTING.value == "executing"
```

---

### 1.2 Implementar Classe Base de Agentes

**Arquivo:** `server/agents/base_agent.py`

```python
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from datetime import datetime
import asyncio
from uuid import uuid4

from .agent_types import AgentConfig, AgentStatus, Tool, Message
from ..memory.conversation_memory import ConversationMemory
from ..memory.shared_context import SharedContext

class BaseAgent(ABC):
    def __init__(self, config: AgentConfig, backend):
        self.id = str(uuid4())
        self.config = config
        self.backend = backend
        self.status = AgentStatus.IDLE
        self.tools: Dict[str, Tool] = {}
        self.memory = ConversationMemory(max_messages=config.max_memory_messages)
        self.shared_context: Optional[SharedContext] = None
        self.message_queue: asyncio.Queue = asyncio.Queue()
        self.current_task: Optional[str] = None
    
    @abstractmethod
    async def act(self, observation: str) -> str:
        """Gerar ação baseada em observação"""
        pass
    
    def register_tool(self, tool: Tool):
        """Registrar ferramenta"""
        if not self._validate_tool(tool):
            raise ValueError(f"Ferramenta inválida: {tool.name}")
        self.tools[tool.name] = tool
    
    async def communicate(self, to_agent: str, message: str, msg_type: str = 'question'):
        """Comunicar com outro agente"""
        msg = Message(
            id=str(uuid4()),
            from_agent=self.config.name,
            to_agent=to_agent,
            content=message,
            message_type=msg_type,
            timestamp=datetime.now()
        )
        # Enfileirar mensagem (será processada por A2A protocol)
        return msg
    
    async def delegate_task(self, to_agent: str, task: Dict[str, Any]):
        """Delegar tarefa para outro agente"""
        delegation_msg = await self.communicate(
            to_agent=to_agent,
            message=f"Delegando tarefa: {task['title']}",
            msg_type='delegation'
        )
        return delegation_msg
    
    async def process_message(self, message: Message):
        """Processar mensagem recebida"""
        self.memory.add_message(
            agent=message.from_agent,
            message=message.content,
            role='assistant'
        )
        
        # Gerar resposta
        response = await self.act(message.content)
        
        # Enviar resposta
        return await self.communicate(
            to_agent=message.from_agent,
            message=response,
            msg_type='response'
        )
    
    async def execute_tool(self, tool_name: str, **kwargs) -> Any:
        """Executar ferramenta"""
        if tool_name not in self.tools:
            raise ValueError(f"Ferramenta não encontrada: {tool_name}")
        
        tool = self.tools[tool_name]
        return await tool.execute(**kwargs)
    
    def _validate_tool(self, tool: Tool) -> bool:
        """Validar ferramenta"""
        return hasattr(tool, 'execute') and callable(tool.execute)
    
    def get_state(self) -> Dict[str, Any]:
        """Obter estado atual do agente"""
        return {
            'id': self.id,
            'name': self.config.name,
            'ala': self.config.ala,
            'status': self.status.value,
            'current_task': self.current_task,
            'tools_count': len(self.tools),
            'memory_size': len(self.memory.messages),
            'expertise': self.config.expertise
        }
```

---

### 1.3 Implementar Agente NETZ Específico

**Arquivo:** `server/agents/netz_agent.py`

```python
from typing import Dict, Any, Optional
from .base_agent import BaseAgent
from .agent_types import AgentConfig, AgentStatus
from ..backends.github_models import GitHubModelsBackend

class NETZAgent(BaseAgent):
    """Agente específico para NETZ com personalidade e expertise"""
    
    def __init__(self, config: AgentConfig, backend: GitHubModelsBackend):
        super().__init__(config, backend)
        self.personality_prompt = self._build_personality_prompt()
    
    async def act(self, observation: str) -> str:
        """Gerar ação com personalidade NETZ"""
        self.status = AgentStatus.THINKING
        
        try:
            # Construir prompt com contexto
            prompt = self._build_prompt(observation)
            
            # Gerar resposta usando backend
            response = await self.backend.generate_response(
                prompt=prompt,
                agent_context={
                    'name': self.config.name,
                    'ala': self.config.ala,
                    'expertise': self.config.expertise,
                    'tools': list(self.tools.keys()),
                    'recent_memory': self.memory.get_context(last_n=5)
                }
            )
            
            # Adicionar à memória
            self.memory.add_message(
                agent=self.config.name,
                message=response,
                role='assistant'
            )
            
            self.status = AgentStatus.IDLE
            return response
        
        except Exception as e:
            self.status = AgentStatus.ERROR
            raise
    
    def _build_personality_prompt(self) -> str:
        """Construir prompt de personalidade"""
        return f"""
Você é {self.config.name}, um agente no Laboratório Maluco da NETZ.

Ala: {self.config.ala}
Expertise: {self.config.expertise}
Descrição: {self.config.role_description}

Ferramentas disponíveis: {', '.join(self.tools.keys())}

Sempre:
1. Mantenha a coesão do time
2. Considere a meta trimestral de R$192k
3. Respeite o protocolo do laboratório
4. Comunique-se claramente com outros agentes
"""
    
    def _build_prompt(self, observation: str) -> str:
        """Construir prompt com contexto"""
        context = self.memory.get_context(last_n=10)
        
        return f"""
{self.personality_prompt}

Contexto recente:
{context}

Observação atual:
{observation}

Responda de forma concisa e acionável.
"""
```

---

### 1.4 Implementar Agent Manager

**Arquivo:** `server/agents/agent_manager.py`

```python
from typing import Dict, List, Optional
from .netz_agent import NETZAgent
from .agent_types import AgentConfig, AlaType
from ..backends.github_models import GitHubModelsBackend

class AgentManager:
    """Gerenciador central de agentes"""
    
    def __init__(self, backend: GitHubModelsBackend):
        self.backend = backend
        self.agents: Dict[str, NETZAgent] = {}
        self.agent_configs: Dict[str, AgentConfig] = {}
    
    def create_agent(self, config: AgentConfig) -> NETZAgent:
        """Criar novo agente"""
        agent = NETZAgent(config, self.backend)
        self.agents[agent.id] = agent
        self.agent_configs[agent.id] = config
        return agent
    
    def get_agent(self, agent_id: str) -> Optional[NETZAgent]:
        """Obter agente por ID"""
        return self.agents.get(agent_id)
    
    def get_agents_by_ala(self, ala: AlaType) -> List[NETZAgent]:
        """Obter agentes por Ala"""
        return [
            agent for agent in self.agents.values()
            if self.agent_configs[agent.id].ala == ala
        ]
    
    def list_agents(self) -> List[Dict]:
        """Listar todos os agentes"""
        return [agent.get_state() for agent in self.agents.values()]
    
    async def shutdown(self):
        """Desligar todos os agentes"""
        for agent in self.agents.values():
            # Cleanup
            pass
```

---

### 1.5 Implementar Tool Registry

**Arquivo:** `server/tools/tool_registry.py`

```python
from typing import Dict, List, Optional
from .base_tool import Tool

class ToolRegistry:
    """Registro central de ferramentas"""
    
    def __init__(self):
        self.tools: Dict[str, Tool] = {}
        self.agent_tools: Dict[str, List[str]] = {}  # agent_id -> tool_names
    
    def register_tool(self, tool: Tool):
        """Registrar ferramenta globalmente"""
        if not self._validate_tool(tool):
            raise ValueError(f"Ferramenta inválida: {tool.name}")
        self.tools[tool.id] = tool
    
    def assign_tool_to_agent(self, agent_id: str, tool_id: str):
        """Atribuir ferramenta a agente"""
        if tool_id not in self.tools:
            raise ValueError(f"Ferramenta não encontrada: {tool_id}")
        
        if agent_id not in self.agent_tools:
            self.agent_tools[agent_id] = []
        
        self.agent_tools[agent_id].append(tool_id)
    
    def get_tools_for_agent(self, agent_id: str) -> List[Tool]:
        """Obter ferramentas de agente"""
        tool_ids = self.agent_tools.get(agent_id, [])
        return [self.tools[tid] for tid in tool_ids if tid in self.tools]
    
    def discover_tools(self, capability: str) -> List[Tool]:
        """Descobrir ferramentas por capacidade"""
        return [
            tool for tool in self.tools.values()
            if capability in tool.capabilities
        ]
    
    def _validate_tool(self, tool: Tool) -> bool:
        """Validar ferramenta"""
        return hasattr(tool, 'execute') and callable(tool.execute)
```

---

### 1.6 Criar Endpoints FastAPI

**Arquivo:** `server/routes/agents.py`

```python
from fastapi import APIRouter, HTTPException
from typing import List
from ..agents.agent_manager import AgentManager
from ..agents.agent_types import AgentConfig, AlaType

router = APIRouter(prefix="/api/agents", tags=["agents"])

# Instância global (em produção, usar dependency injection)
agent_manager: AgentManager = None

@router.get("/")
async def list_agents():
    """Listar todos os agentes"""
    return agent_manager.list_agents()

@router.get("/{agent_id}")
async def get_agent(agent_id: str):
    """Obter agente específico"""
    agent = agent_manager.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agente não encontrado")
    return agent.get_state()

@router.post("/")
async def create_agent(config: AgentConfig):
    """Criar novo agente"""
    agent = agent_manager.create_agent(config)
    return agent.get_state()

@router.post("/{agent_id}/act")
async def agent_act(agent_id: str, observation: str):
    """Agente executar ação"""
    agent = agent_manager.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agente não encontrado")
    
    response = await agent.act(observation)
    return {"response": response}

@router.get("/ala/{ala}")
async def get_agents_by_ala(ala: AlaType):
    """Obter agentes por Ala"""
    agents = agent_manager.get_agents_by_ala(ala)
    return [agent.get_state() for agent in agents]
```

---

### 1.7 Testes Unitários

**Arquivo:** `server/tests/test_agents.py`

```python
import pytest
import asyncio
from agents.agent_types import AgentConfig, AlaType
from agents.netz_agent import NETZAgent
from agents.agent_manager import AgentManager
from backends.github_models import GitHubModelsBackend

@pytest.fixture
def backend():
    return GitHubModelsBackend(token="test_token")

@pytest.fixture
def agent_config():
    return AgentConfig(
        name="Mintzie",
        ala=AlaType.TECNOLOGIA,
        expertise="Coordenação",
        role_description="Guardião Cultural",
        tools=[]
    )

@pytest.mark.asyncio
async def test_agent_creation(backend, agent_config):
    agent = NETZAgent(agent_config, backend)
    assert agent.config.name == "Mintzie"
    assert agent.status.value == "idle"

@pytest.mark.asyncio
async def test_agent_manager(backend, agent_config):
    manager = AgentManager(backend)
    agent = manager.create_agent(agent_config)
    
    retrieved = manager.get_agent(agent.id)
    assert retrieved is not None
    assert retrieved.config.name == "Mintzie"

def test_agent_manager_list_agents(backend, agent_config):
    manager = AgentManager(backend)
    manager.create_agent(agent_config)
    
    agents = manager.list_agents()
    assert len(agents) == 1
    assert agents[0]['name'] == "Mintzie"
```

---

## ✅ Checklist Fase 1

- [ ] 1.1 Criar branch `feature/multi-agent-base`
- [ ] 1.2 Instalar dependências
- [ ] 1.3 Criar estrutura de pastas
- [ ] 1.4 Implementar tipos em `agent_types.py`
- [ ] 1.5 Implementar `base_agent.py`
- [ ] 1.6 Implementar `netz_agent.py`
- [ ] 1.7 Implementar `agent_manager.py`
- [ ] 1.8 Implementar `tool_registry.py`
- [ ] 1.9 Criar endpoints FastAPI
- [ ] 1.10 Implementar testes unitários
- [ ] 1.11 Testar endpoints com Postman/curl
- [ ] 1.12 Fazer PR e merge para `main`

---

## 🎯 Fase 2: Comunicação A2A (Semanas 3-4)

### 2.0 Preparação
- [ ] 2.1 Criar branch `feature/a2a-communication`
- [ ] 2.2 Instalar Redis: `pip install redis aioredis`

### 2.1 Implementar Message Queue

**Arquivo:** `server/communication/message_queue.py`

```python
import asyncio
from typing import Dict, List, Callable
from .message_types import Message

class MessageQueue:
    """Fila de mensagens para comunicação A2A"""
    
    def __init__(self):
        self.queues: Dict[str, asyncio.Queue] = {}
        self.subscribers: Dict[str, List[Callable]] = {}
    
    async def send(self, to_agent: str, message: Message):
        """Enviar mensagem para agente"""
        if to_agent not in self.queues:
            self.queues[to_agent] = asyncio.Queue()
        
        await self.queues[to_agent].put(message)
        
        # Notificar subscribers
        if to_agent in self.subscribers:
            for callback in self.subscribers[to_agent]:
                await callback(message)
    
    async def receive(self, agent_id: str) -> Message:
        """Receber mensagem para agente"""
        if agent_id not in self.queues:
            self.queues[agent_id] = asyncio.Queue()
        
        return await self.queues[agent_id].get()
    
    def subscribe(self, agent_id: str, callback: Callable):
        """Inscrever callback para mensagens"""
        if agent_id not in self.subscribers:
            self.subscribers[agent_id] = []
        
        self.subscribers[agent_id].append(callback)
```

### 2.2 Implementar A2A Protocol

**Arquivo:** `server/communication/a2a_protocol.py`

```python
from typing import Dict, Optional
from .message_queue import MessageQueue
from .message_types import Message
from ..agents.agent_manager import AgentManager

class A2AProtocol:
    """Protocol para comunicação Agent-to-Agent"""
    
    def __init__(self, message_queue: MessageQueue, agent_manager: AgentManager):
        self.message_queue = message_queue
        self.agent_manager = agent_manager
        self.message_history: Dict[str, List[Message]] = {}
    
    async def send_message(self, from_agent: str, to_agent: str, content: str, msg_type: str = 'question'):
        """Enviar mensagem de um agente para outro"""
        # Validar agentes
        if not self.agent_manager.get_agent(from_agent):
            raise ValueError(f"Agente origem não encontrado: {from_agent}")
        
        if not self.agent_manager.get_agent(to_agent):
            raise ValueError(f"Agente destino não encontrado: {to_agent}")
        
        # Criar mensagem
        message = Message(
            id=str(uuid4()),
            from_agent=from_agent,
            to_agent=to_agent,
            content=content,
            message_type=msg_type,
            timestamp=datetime.now()
        )
        
        # Enfileirar
        await self.message_queue.send(to_agent, message)
        
        # Registrar no histórico
        if to_agent not in self.message_history:
            self.message_history[to_agent] = []
        self.message_history[to_agent].append(message)
    
    async def delegate_task(self, from_agent: str, to_agent: str, task: Dict):
        """Delegar tarefa"""
        await self.send_message(
            from_agent=from_agent,
            to_agent=to_agent,
            content=f"Delegando: {task['title']}",
            msg_type='delegation'
        )
    
    def get_message_history(self, agent_id: str) -> List[Message]:
        """Obter histórico de mensagens"""
        return self.message_history.get(agent_id, [])
```

---

## 🎯 Fase 3: Orquestração (Semanas 5-6)

### 3.0 Preparação
- [ ] 3.1 Criar branch `feature/orchestration`

### 3.1 Implementar Agent Orchestrator

**Arquivo:** `server/orchestration/orchestrator.py`

```python
from typing import List, Dict, Any
from ..agents.agent_manager import AgentManager
from ..communication.a2a_protocol import A2AProtocol

class AgentOrchestrator:
    """Orquestrador de workflows com múltiplos agentes"""
    
    def __init__(self, agent_manager: AgentManager, a2a_protocol: A2AProtocol):
        self.agent_manager = agent_manager
        self.a2a_protocol = a2a_protocol
    
    async def execute_workflow(self, workflow: Dict[str, Any]):
        """Executar workflow"""
        for step in workflow['steps']:
            # Selecionar agente apropriado
            agent = self._select_agent(step)
            
            # Executar ação
            result = await agent.act(step['input'])
            
            # Atualizar estado
            step['output'] = result
    
    def _select_agent(self, step: Dict) -> Any:
        """Selecionar agente apropriado para step"""
        required_capability = step.get('required_capability')
        # Lógica de seleção...
        return None
```

---

## 🎯 Fase 4: Frontend Visual (Semanas 7-8)

### 4.0 Preparação
- [ ] 4.1 Criar branch `feature/agent-ui`
- [ ] 4.2 Instalar React Flow: `pnpm add reactflow`

### 4.1 Criar Componente AgentList

**Arquivo:** `client/src/components/MultiAgent/AgentList.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { useAgent } from '@/hooks/useAgent';

export function AgentList() {
  const { agents, loading } = useAgent();

  if (loading) return <div>Carregando agentes...</div>;

  return (
    <div className="space-y-2">
      {agents.map(agent => (
        <div key={agent.id} className="bg-white/10 p-3 rounded-lg">
          <h4 className="font-medium text-white">{agent.name}</h4>
          <p className="text-sm text-white/60">{agent.expertise}</p>
          <p className="text-xs text-white/40">Status: {agent.status}</p>
        </div>
      ))}
    </div>
  );
}
```

---

## 📦 Dependências Necessárias

```
# Backend
fastapi==0.104.1
pydantic==2.5.0
aioredis==2.0.1
redis==5.0.1
python-dotenv==1.0.0
httpx==0.25.0

# Frontend
react@^19.2.1
react-flow-renderer@^11.10.0
zustand@^4.5.0
```

---

## 🚀 Próximos Passos

1. **Revisar este plano** com o time
2. **Criar branch** `feature/multi-agent-base`
3. **Implementar Fase 1** (2 semanas)
4. **Fazer PR** e revisar com time
5. **Merge** e deploy
6. **Continuar com Fase 2, 3, 4**

---

**Última atualização:** 18/03/2026  
**Status:** Pronto para implementação  
**Responsável:** Codex (IA Developer)
