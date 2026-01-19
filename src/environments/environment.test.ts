export const environment = {
  production: false,

  apiBase: 'https://k2ok2k1ft9.execute-api.us-east-1.amazonaws.com/dev',
  apiUrl: 'https://k2ok2k1ft9.execute-api.us-east-1.amazonaws.com/dev',

  cognito: {
    domain: 'fitness-planner-dev-auth.auth.us-east-1.amazoncognito.com',

    // MISMO user pool (correcto)
    userPoolId: 'us-east-1_8jk4VBnTQ',

    // 🔥 NUEVO APP CLIENT (client-app)
    clientId: '7hdpq9lbf0km3noeglgmg26cpm',

    // 🔥 PUERTO DE LA CLIENT APP
    redirectUri: 'http://localhost:4300/callback'
  }
};
