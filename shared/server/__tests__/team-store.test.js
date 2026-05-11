import { describe, it, expect } from 'vitest'

const {
  createTeam,
  renameTeam,
  deleteTeam,
  assignMember,
  assignMembersBulk,
  unassignMember,
  getUnassigned,
  updateTeamFields
} = require('../team-store');

function createMockStorage(initialData = {}) {
  const store = {};
  for (const [key, val] of Object.entries(initialData)) {
    store[key] = JSON.parse(JSON.stringify(val));
  }
  return {
    readFromStorage(key) { return store[key] ? JSON.parse(JSON.stringify(store[key])) : null; },
    writeToStorage(key, data) { store[key] = JSON.parse(JSON.stringify(data)); },
    _store: store
  };
}

const baseRegistry = {
  people: {
    achen: { uid: 'achen', name: 'Alice Chen', email: 'achen@example.com', status: 'active', managerUid: 'demovp', orgRoot: 'achen' },
    bsmith: { uid: 'bsmith', name: 'Bob Smith', email: 'bsmith@example.com', status: 'active', managerUid: 'achen', orgRoot: 'achen' },
    cwilliams: { uid: 'cwilliams', name: 'Carol', email: 'cwilliams@example.com', status: 'active', managerUid: 'achen', orgRoot: 'achen' },
    inactive: { uid: 'inactive', name: 'Gone', email: 'gone@example.com', status: 'inactive', managerUid: 'achen', orgRoot: 'achen' }
  }
};

describe('createTeam', () => {
  it('creates a team with generated ID', () => {
    const storage = createMockStorage({ 'team-data/teams.json': { teams: {} } });
    const team = createTeam(storage, 'Platform', 'achen', 'admin@example.com');
    expect(team.id).toMatch(/^team_[a-f0-9]{6}$/);
    expect(team.name).toBe('Platform');
    expect(team.orgKey).toBe('achen');
    expect(team.createdBy).toBe('admin@example.com');
    expect(team.metadata).toEqual({});
  });

  it('writes audit log entry', () => {
    const storage = createMockStorage({ 'team-data/teams.json': { teams: {} } });
    createTeam(storage, 'Platform', 'achen', 'admin@example.com');
    const log = storage.readFromStorage('audit-log.json');
    expect(log.entries).toHaveLength(1);
    expect(log.entries[0].action).toBe('team.create');
  });
});

describe('renameTeam', () => {
  it('renames an existing team', () => {
    const storage = createMockStorage({
      'team-data/teams.json': { teams: { team_abc123: { id: 'team_abc123', name: 'Old', orgKey: 'achen', metadata: {} } } }
    });
    const result = renameTeam(storage, 'team_abc123', 'New', 'admin@example.com');
    expect(result.name).toBe('New');
  });

  it('returns null for non-existent team', () => {
    const storage = createMockStorage({ 'team-data/teams.json': { teams: {} } });
    expect(renameTeam(storage, 'team_xxx', 'New', 'admin@example.com')).toBeNull();
  });
});

describe('deleteTeam', () => {
  it('deletes a team and removes from person teamIds', () => {
    const storage = createMockStorage({
      'team-data/teams.json': { teams: { team_abc: { id: 'team_abc', name: 'Platform', orgKey: 'achen', metadata: {} } } },
      'team-data/registry.json': {
        people: {
          bsmith: { uid: 'bsmith', name: 'Bob', status: 'active', teamIds: ['team_abc', 'team_other'] }
        }
      }
    });

    const result = deleteTeam(storage, 'team_abc', 'admin@example.com');
    expect(result.name).toBe('Platform');

    const teams = storage.readFromStorage('team-data/teams.json');
    expect(teams.teams.team_abc).toBeUndefined();

    const reg = storage.readFromStorage('team-data/registry.json');
    expect(reg.people.bsmith.teamIds).toEqual(['team_other']);
  });
});

describe('assignMember', () => {
  it('assigns a person to a team', () => {
    const storage = createMockStorage({
      'team-data/teams.json': { teams: { team_abc: { id: 'team_abc', name: 'Platform', orgKey: 'achen', metadata: {} } } },
      'team-data/registry.json': baseRegistry
    });

    const result = assignMember(storage, 'team_abc', 'bsmith', 'admin@example.com');
    expect(result.assigned).toBe(true);

    const reg = storage.readFromStorage('team-data/registry.json');
    expect(reg.people.bsmith.teamIds).toContain('team_abc');
  });

  it('skips if already assigned', () => {
    const storage = createMockStorage({
      'team-data/teams.json': { teams: { team_abc: { id: 'team_abc', name: 'Platform', orgKey: 'achen', metadata: {} } } },
      'team-data/registry.json': {
        people: { bsmith: { uid: 'bsmith', name: 'Bob', status: 'active', teamIds: ['team_abc'] } }
      }
    });

    const result = assignMember(storage, 'team_abc', 'bsmith', 'admin@example.com');
    expect(result.skipped).toBe(true);
  });

  it('returns error for non-existent team', () => {
    const storage = createMockStorage({
      'team-data/teams.json': { teams: {} },
      'team-data/registry.json': baseRegistry
    });
    const result = assignMember(storage, 'team_xxx', 'bsmith', 'admin@example.com');
    expect(result.error).toBeTruthy();
  });
});

describe('assignMembersBulk', () => {
  it('assigns multiple people', () => {
    const storage = createMockStorage({
      'team-data/teams.json': { teams: { team_abc: { id: 'team_abc', name: 'Platform', orgKey: 'achen', metadata: {} } } },
      'team-data/registry.json': baseRegistry
    });

    const result = assignMembersBulk(storage, 'team_abc', ['bsmith', 'cwilliams'], 'admin@example.com');
    expect(result.assigned).toEqual(['bsmith', 'cwilliams']);
    expect(result.skipped).toEqual([]);
  });

  it('skips already-assigned and non-existent', () => {
    const reg = JSON.parse(JSON.stringify(baseRegistry));
    reg.people.bsmith.teamIds = ['team_abc'];
    const storage = createMockStorage({
      'team-data/teams.json': { teams: { team_abc: { id: 'team_abc', name: 'Platform', orgKey: 'achen', metadata: {} } } },
      'team-data/registry.json': reg
    });

    const result = assignMembersBulk(storage, 'team_abc', ['bsmith', 'cwilliams', 'nonexistent'], 'admin@example.com');
    expect(result.assigned).toEqual(['cwilliams']);
    expect(result.skipped).toEqual(['bsmith', 'nonexistent']);
  });
});

describe('unassignMember', () => {
  it('removes team from person teamIds', () => {
    const storage = createMockStorage({
      'team-data/teams.json': { teams: { team_abc: { id: 'team_abc', name: 'Platform', orgKey: 'achen', metadata: {} } } },
      'team-data/registry.json': {
        people: { bsmith: { uid: 'bsmith', name: 'Bob', status: 'active', teamIds: ['team_abc'] } }
      }
    });

    const result = unassignMember(storage, 'team_abc', 'bsmith', 'admin@example.com');
    expect(result.unassigned).toBe(true);

    const reg = storage.readFromStorage('team-data/registry.json');
    expect(reg.people.bsmith.teamIds).toEqual([]);
  });
});

describe('getUnassigned', () => {
  const { buildManagerMap } = require('../permissions');
  const reg = JSON.parse(JSON.stringify(baseRegistry));
  // bsmith has a team, others don't
  reg.people.bsmith.teamIds = ['team_abc'];
  const managerMap = buildManagerMap(reg);

  it('returns all unassigned for admin with scope=all', () => {
    const storage = createMockStorage();
    const result = getUnassigned(storage, 'all', null, true, managerMap, reg);
    // achen, cwilliams are active without teams (inactive excluded)
    expect(result.map(p => p.uid).sort()).toEqual(['achen', 'cwilliams']);
  });

  it('returns direct reports for scope=direct', () => {
    const storage = createMockStorage();
    const result = getUnassigned(storage, 'direct', 'achen', false, managerMap, reg);
    // achen's direct report without teams: cwilliams (bsmith has a team)
    expect(result.map(p => p.uid)).toEqual(['cwilliams']);
  });

  it('returns org subtree for scope=org', () => {
    const storage = createMockStorage();
    const result = getUnassigned(storage, 'org', 'achen', false, managerMap, reg);
    // achen manages bsmith (has team) and cwilliams (no team)
    expect(result.map(p => p.uid)).toEqual(['cwilliams']);
  });

  it('returns empty for non-admin with scope=all', () => {
    const storage = createMockStorage();
    const result = getUnassigned(storage, 'all', 'achen', false, managerMap, reg);
    expect(result).toHaveLength(0);
  });

  it('returns empty for invalid scope value', () => {
    const storage = createMockStorage();
    const result = getUnassigned(storage, 'invalid', 'achen', true, managerMap, reg);
    expect(result).toHaveLength(0);
  });
});

describe('updateTeamFields', () => {
  it('updates team metadata fields', () => {
    const storage = createMockStorage({
      'team-data/teams.json': { teams: { team_abc: { id: 'team_abc', name: 'Platform', orgKey: 'achen', metadata: {} } } }
    });

    const result = updateTeamFields(storage, 'team_abc', { field_1: 'value1' }, 'admin@example.com');
    expect(result.metadata.field_1).toBe('value1');
  });
});
