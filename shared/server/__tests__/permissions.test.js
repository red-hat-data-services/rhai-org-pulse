import { describe, it, expect } from 'vitest'

const {
  LDAP_FIELDS,
  buildManagerMap,
  getManagedUids,
  getDirectReports,
  isManager,
  getPermissionTier,
  canEditPerson
} = require('../permissions');

// Two-level hierarchy:
// demovp -> achen -> bsmith, cwilliams
// demovp -> fjohnson -> gkim, hwilson
const registry = {
  people: {
    demovp: { uid: 'demovp', name: 'VP', email: 'vp@example.com', status: 'active', managerUid: null },
    achen: { uid: 'achen', name: 'Alice Chen', email: 'achen@example.com', status: 'active', managerUid: 'demovp' },
    bsmith: { uid: 'bsmith', name: 'Bob Smith', email: 'bsmith@example.com', status: 'active', managerUid: 'achen' },
    cwilliams: { uid: 'cwilliams', name: 'Carol Williams', email: 'cwilliams@example.com', status: 'active', managerUid: 'achen' },
    fjohnson: { uid: 'fjohnson', name: 'Frank Johnson', email: 'fjohnson@example.com', status: 'active', managerUid: 'demovp' },
    gkim: { uid: 'gkim', name: 'Grace Kim', email: 'gkim@example.com', status: 'active', managerUid: 'fjohnson' },
    hwilson: { uid: 'hwilson', name: 'Henry Wilson', email: 'hwilson@example.com', status: 'active', managerUid: 'fjohnson' },
    inactive: { uid: 'inactive', name: 'Gone', email: 'gone@example.com', status: 'inactive', managerUid: 'achen' }
  }
};

describe('LDAP_FIELDS', () => {
  it('contains expected protected fields', () => {
    expect(LDAP_FIELDS).toContain('uid');
    expect(LDAP_FIELDS).toContain('name');
    expect(LDAP_FIELDS).toContain('email');
    expect(LDAP_FIELDS).toContain('managerUid');
    expect(LDAP_FIELDS).toContain('title');
  });
});

describe('buildManagerMap', () => {
  it('builds transitive closure of managed UIDs', () => {
    const map = buildManagerMap(registry);
    // demovp manages everyone (achen -> bsmith, cwilliams; fjohnson -> gkim, hwilson)
    const vpManaged = map.get('demovp');
    expect(vpManaged).toBeDefined();
    expect(vpManaged.has('achen')).toBe(true);
    expect(vpManaged.has('bsmith')).toBe(true);
    expect(vpManaged.has('cwilliams')).toBe(true);
    expect(vpManaged.has('fjohnson')).toBe(true);
    expect(vpManaged.has('gkim')).toBe(true);
    expect(vpManaged.has('hwilson')).toBe(true);
  });

  it('mid-level manager sees only their subtree', () => {
    const map = buildManagerMap(registry);
    const achenManaged = map.get('achen');
    expect(achenManaged.has('bsmith')).toBe(true);
    expect(achenManaged.has('cwilliams')).toBe(true);
    expect(achenManaged.has('fjohnson')).toBe(false);
    expect(achenManaged.has('gkim')).toBe(false);
  });

  it('leaf nodes are not managers', () => {
    const map = buildManagerMap(registry);
    expect(map.has('bsmith')).toBe(false);
  });

  it('excludes inactive people from managed sets', () => {
    const map = buildManagerMap(registry);
    const achenManaged = map.get('achen');
    expect(achenManaged.has('inactive')).toBe(false);
  });

  it('handles null/empty registry', () => {
    expect(buildManagerMap(null).size).toBe(0);
    expect(buildManagerMap({ people: {} }).size).toBe(0);
  });
});

describe('getManagedUids', () => {
  it('returns empty set for non-managers', () => {
    const map = buildManagerMap(registry);
    const result = getManagedUids('bsmith', map);
    expect(result.size).toBe(0);
  });

  it('returns managed set for managers', () => {
    const map = buildManagerMap(registry);
    const result = getManagedUids('fjohnson', map);
    expect(result.has('gkim')).toBe(true);
    expect(result.has('hwilson')).toBe(true);
    expect(result.size).toBe(2);
  });
});

describe('getDirectReports', () => {
  it('returns only direct reports, not transitive', () => {
    const direct = getDirectReports('demovp', registry);
    expect(direct.has('achen')).toBe(true);
    expect(direct.has('fjohnson')).toBe(true);
    expect(direct.has('bsmith')).toBe(false);
    expect(direct.size).toBe(2);
  });

  it('returns empty set for leaf nodes', () => {
    const direct = getDirectReports('bsmith', registry);
    expect(direct.size).toBe(0);
  });

  it('excludes inactive people', () => {
    const direct = getDirectReports('achen', registry);
    expect(direct.has('inactive')).toBe(false);
  });
});

describe('isManager', () => {
  it('returns true for managers', () => {
    expect(isManager('achen', registry)).toBe(true);
    expect(isManager('fjohnson', registry)).toBe(true);
    expect(isManager('demovp', registry)).toBe(true);
  });

  it('returns false for leaf nodes', () => {
    expect(isManager('bsmith', registry)).toBe(false);
    expect(isManager('gkim', registry)).toBe(false);
  });

  it('returns false for null registry', () => {
    expect(isManager('achen', null)).toBe(false);
  });
});

describe('getPermissionTier', () => {
  it('returns admin when isAdmin flag is true', () => {
    expect(getPermissionTier('achen', registry, true)).toBe('admin');
  });

  it('returns admin even with null uid when isAdmin', () => {
    expect(getPermissionTier(null, registry, true)).toBe('admin');
  });

  it('returns manager for managers', () => {
    expect(getPermissionTier('achen', registry, false)).toBe('manager');
  });

  it('returns user for non-managers', () => {
    expect(getPermissionTier('bsmith', registry, false)).toBe('user');
  });

  it('returns user for null uid when not admin', () => {
    expect(getPermissionTier(null, registry, false)).toBe('user');
  });
});

describe('canEditPerson', () => {
  const map = buildManagerMap(registry);

  it('admin can edit anyone', () => {
    expect(canEditPerson(null, 'bsmith', true, map)).toBe(true);
    expect(canEditPerson('achen', 'gkim', true, map)).toBe(true);
  });

  it('manager can edit subordinates', () => {
    expect(canEditPerson('achen', 'bsmith', false, map)).toBe(true);
    expect(canEditPerson('achen', 'cwilliams', false, map)).toBe(true);
  });

  it('manager cannot edit people outside subtree', () => {
    expect(canEditPerson('achen', 'gkim', false, map)).toBe(false);
    expect(canEditPerson('fjohnson', 'bsmith', false, map)).toBe(false);
  });

  it('non-manager cannot edit anyone', () => {
    expect(canEditPerson('bsmith', 'cwilliams', false, map)).toBe(false);
  });

  it('null actorUid (non-admin) cannot edit', () => {
    expect(canEditPerson(null, 'bsmith', false, map)).toBe(false);
  });
});
