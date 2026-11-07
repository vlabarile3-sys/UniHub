(() => {
  const now = Date.now();
  const at = (hoursAgo) => new Date(now - hoursAgo * 60 * 60 * 1000).toISOString();
  const workflows = ['DEMO', 'SUPPORT', 'ONBOARDING', 'OPERATIONS', 'INSIGHTS', 'AUTOMATION'];
  const tasks = ['Content Review', 'Knowledge Article Update', 'Weekly Insights', 'Team Onboarding'];

  let appData = {
    db: [
      { id: 'demo-resource-1', title: 'Demo Playbook — Getting Started', url: 'https://example.com/demo/playbook', category: 'root', type: 'doc', tags: ['demo', 'guide'], isAgentVisible: true },
      { id: 'demo-resource-2', title: 'Sample Workflow Metrics', url: 'https://example.com/demo/metrics', category: 'root', type: 'sheet', tags: ['demo', 'metrics'], isAgentVisible: true }
    ],
    pocs: [{ id: 1001, task: tasks[0], pocName: 'Alex Morgan', month: new Date().toISOString().slice(0, 7) }],
    cats: [{ id: 'root', name: 'Shared Materials', parentId: null }],
    qas: ['Alex Morgan', 'Sam Taylor', 'Jordan Lee'],
    links: {},
    channels: ['General KB', 'Team Guides', 'Release Notes'],
    workflows,
    workflowPolicies: Object.fromEntries(workflows.map((workflow) => [workflow, ['Approved', 'Needs Review', 'Example']])),
    workflowTasks: Object.fromEntries(workflows.map((workflow) => [workflow, tasks]))
  };

  let alignments = [
    {
      date: at(1),
      verdict: 'Approved',
      user: 'How can I write a clear project update?',
      bot: 'Start with the outcome, summarize progress, then list decisions and next steps.',
      description: 'Fictional example for demonstrating searchable team guidance.',
      channel: 'General KB',
      _history: []
    },
    {
      date: at(24),
      verdict: 'Needs Review',
      user: 'What should a useful handoff include?',
      bot: 'Include current status, owner, relevant links, and the next action.',
      description: 'Second fictional record used only for the demo.',
      channel: 'Team Guides',
      _history: []
    }
  ];

  let pins = [{
    id: 'demo-pin-1',
    title: 'Demo Playbook',
    url: 'https://example.com/demo/playbook',
    agentVisible: true,
    addedBy: 'Demo Studio'
  }];
  let broadcasts = [{
    id: 'demo-broadcast-1',
    author: 'Demo Studio',
    target: 'ALL',
    scheduled: new Date(now - 60 * 60 * 1000).toISOString(),
    payload: 'Welcome to the fictional FlowPilot demo. Explore the sample workflows and shared guides.',
    priority: 'NORMAL'
  }];
  const canvasStates = {};
  const sheetConfigs = {};

  const clone = (value) => JSON.parse(JSON.stringify(value));

  function getMetrics() {
    return alignments.reduce((metrics, item) => {
      const channel = item.channel || 'General KB';
      const workflow = 'DEMO';
      if (!metrics[channel]) metrics[channel] = { _total: 0 };
      metrics[channel][workflow] = (metrics[channel][workflow] || 0) + 1;
      metrics[channel]._total += 1;
      return metrics;
    }, {});
  }

  function normalizeAlignment(item) {
    return {
      date: item.date || new Date().toISOString(),
      verdict: item.verdict || 'Review',
      user: item.user || '',
      bot: item.bot || '',
      description: item.description || '',
      channel: item.channel || 'General KB',
      _history: Array.isArray(item._history) ? item._history : []
    };
  }

  function dispatch(method, args) {
    switch (method) {
      case 'loadGlobalData':
        return clone(appData);
      case 'saveGlobalData':
        appData = JSON.parse(args[0]);
        return { success: true };
      case 'getKnowledgeMetrics':
        return { success: true, data: getMetrics() };
      case 'fetchAlignments':
        return { success: true, data: clone(alignments) };
      case 'publishAlignments': {
        const items = JSON.parse(args[0]);
        if (!Array.isArray(items)) throw new Error('Expected an array of sample InfoCards.');
        alignments = alignments.concat(items.map(normalizeAlignment));
        return { success: true, count: items.length };
      }
      case 'updateAlignment': {
        const [date, _workflow, updated, original] = args;
        const item = alignments.find((entry) =>
          new Date(entry.date).getTime() === new Date(date).getTime() &&
          entry.user === original.user && entry.bot === original.bot
        );
        if (!item) return { success: false, error: 'Demo InfoCard not found.' };
        Object.assign(item, normalizeAlignment({ ...item, ...updated }));
        return { success: true, message: 'Demo InfoCard updated.' };
      }
      case 'deleteAlignment': {
        const [date, _workflow, original] = args;
        const before = alignments.length;
        alignments = alignments.filter((entry) =>
          !(new Date(entry.date).getTime() === new Date(date).getTime() &&
            entry.user === original.user && entry.bot === original.bot)
        );
        return alignments.length < before
          ? { success: true }
          : { success: false, error: 'Demo InfoCard not found.' };
      }
      case 'getPinsData':
        return { success: true, data: clone(pins) };
      case 'saveQuickPinData': {
        const payload = JSON.parse(args[0]);
        if (payload.id) {
          const index = pins.findIndex((pin) => pin.id === payload.id);
          if (index < 0) return { success: false, error: 'Demo link not found.' };
          pins[index] = { ...pins[index], ...payload };
        } else {
          pins.push({ ...payload, id: `demo-pin-${Date.now()}`, addedBy: 'Demo Studio' });
        }
        return { success: true };
      }
      case 'deleteQuickPinData': {
        const before = pins.length;
        pins = pins.filter((pin) => pin.id !== String(args[0]));
        return pins.length < before
          ? { success: true }
          : { success: false, error: 'Demo link not found.' };
      }
      case 'fetchBroadcasts':
        return {
          success: true,
          data: clone(broadcasts.filter((item) => item.target === 'ALL' || item.target === args[0]))
        };
      case 'publishBroadcast': {
        const payload = JSON.parse(args[0]);
        broadcasts.push({
          ...payload,
          id: `demo-broadcast-${Date.now()}`,
          author: payload.author || 'Demo Studio',
          scheduled: payload.scheduled || new Date().toISOString(),
          priority: payload.priority || 'NORMAL'
        });
        return { success: true };
      }
      case 'deleteBroadcast': {
        const before = broadcasts.length;
        broadcasts = broadcasts.filter((item) => item.id !== String(args[0]));
        return broadcasts.length < before
          ? { success: true }
          : { success: false, error: 'Demo broadcast not found.' };
      }
      case 'getAclMap':
        return { 'demo.reviewer@example.invalid': 'QA' };
      case 'getAgentsForDropdown':
        return [{ name: 'Demo Agent', email: 'demo.agent@example.invalid' }];
      case 'getThreadsForDropdown':
        return [];
      case 'loadCanvasState':
        return { success: true, data: canvasStates[String(args[0] || 'OPS')] || '' };
      case 'saveCanvasState':
        canvasStates[String(args[1] || 'OPS')] = args[0];
        return { success: true, message: 'Demo workflow saved in memory.' };
      case 'executeManualWorkflow':
        return { success: true, output: 'Workflow simulated locally; no Gmail, Drive, or external service was contacted.' };
      case 'getSheetMetadata':
        return { success: true, metadata: [{ name: 'DEMO_Alignments', id: 1, index: 0 }] };
      case 'getSheetHeaders':
        return { success: true, headers: ['DATE', 'VERDICT', 'USER_PROMPT', 'BOT_RESPONSE', 'DESCRIPTION', 'CHANNEL'] };
      case 'loadSheetConfig': {
        const config = args[0] || {};
        return sheetConfigs[`${config.spreadsheetId || ''}:${config.sheetName || ''}`] || null;
      }
      case 'saveSheetConfig': {
        const config = args[0];
        sheetConfigs[`${config.spreadsheetId || ''}:${config.sheetName || ''}`] = clone(config);
        return { success: true };
      }
      case 'fetchFullSheetData':
        return { success: false, error: 'External spreadsheet access is disabled in this browser demo.' };
      case 'searchAdvancedMultiTab':
      case 'searchGlobalFast':
        return { success: true, data: [] };
      case 'executeStudioAction':
        return { success: true, message: 'Studio action simulated locally; no email or Drive file was created.' };
      case 'uploadImageToDrive':
        return { success: false, error: 'Drive uploads are unavailable in the browser demo.' };
      default:
        throw new Error(`“${method}” is not available in the offline demo.`);
    }
  }

  function createRunner(successHandler, failureHandler, userObject) {
    return new Proxy({}, {
      get(_target, property) {
        if (property === 'withSuccessHandler') {
          return (handler) => createRunner(handler, failureHandler, userObject);
        }
        if (property === 'withFailureHandler') {
          return (handler) => createRunner(successHandler, handler, userObject);
        }
        if (property === 'withUserObject') {
          return (value) => createRunner(successHandler, failureHandler, value);
        }
        if (property === 'then') return undefined;
        return (...args) => {
          setTimeout(() => {
            try {
              const result = dispatch(String(property), args);
              if (successHandler) successHandler(result, userObject);
            } catch (error) {
              if (failureHandler) failureHandler(error, userObject);
              else {
                console.error(error);
                if (typeof window.showToast === 'function') window.showToast(error.message, 'error');
              }
            }
          }, 0);
        };
      }
    });
  }

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  window.google.script.run = createRunner();
})();
