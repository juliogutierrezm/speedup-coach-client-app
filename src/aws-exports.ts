// AWS Amplify configuration — CLIENT APP
export const awsExports = {
  aws_project_region: 'us-east-1',
  aws_cognito_region: 'us-east-1',

  // MISMO user pool (bien)
  aws_user_pools_id: 'us-east-1_8jk4VBnTQ',

  // 🔥 NUEVO APP CLIENT (client-only)
  aws_user_pools_web_client_id: '7hdpq9lbf0km3noeglgmg26cpm',

  oauth: {
    domain: 'fitness-planner-dev-auth.auth.us-east-1.amazoncognito.com',
    scope: ['email', 'openid', 'profile'],

    // 🔥 PUERTO DE LA CLIENT APP
    redirectSignIn: 'http://localhost:4300/callback',
    redirectSignOut: 'http://localhost:4300/login',

    responseType: 'code'
  },

  federationTarget: 'COGNITO_USER_POOLS',
  aws_cognito_username_attributes: ['email'],
  aws_cognito_social_providers: [],
  aws_cognito_signup_attributes: ['email', 'family_name', 'given_name'],
  aws_cognito_mfa_configuration: 'OFF',
  aws_cognito_mfa_types: ['SMS'],
  aws_cognito_password_protection_settings: {
    passwordPolicyMinLength: 8,
    passwordPolicyCharacters: []
  },
  aws_cognito_verification_mechanisms: ['email']
};
