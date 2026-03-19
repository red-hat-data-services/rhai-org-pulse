/**
 * Shared constants for roster sync.
 */

const LDAP_HOST = 'ldap://ldap.corp.redhat.com';
const LDAP_BASE = 'dc=redhat,dc=com';
const LDAP_USER_BASE = 'ou=users,dc=redhat,dc=com';

const LDAP_ATTRS = [
  'cn', 'uid', 'mail', 'title', 'l', 'co',
  'manager', 'rhatGeo', 'rhatLocation', 'rhatOfficeLocation',
  'rhatCostCenter', 'rhatSocialUrl'
];

const EXCLUDED_TITLES = ['Intern', 'Collaborative Partner', 'Independent Contractor'];

const DEFAULT_SHEET_COLUMNS = {
  name: "Associate's Name",
  manager: "Manager's Name",
  miroTeam: 'Scrum Team Name (miro)',
  jiraComponent: 'Primary Jira Component',
  jiraTeam: 'Jira Team Name (from Shared Teams View)',
  pm: 'PM',
  engLead: 'Eng Lead (Staff Engineer)',
  status: 'Status',
  specialty: 'Engineering Speciality',
  subcomponent: 'Subcomponent Area of Work',
  region: 'Region'
};

module.exports = {
  LDAP_HOST,
  LDAP_BASE,
  LDAP_USER_BASE,
  LDAP_ATTRS,
  EXCLUDED_TITLES,
  DEFAULT_SHEET_COLUMNS
};
