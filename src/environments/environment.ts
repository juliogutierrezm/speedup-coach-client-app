export const environment = {
  production: false,
  cognito: {
    domain: 'fitness-planner-dev-auth.auth.us-east-1.amazoncognito.com',
    userPoolId: 'us-east-1_8jk4VBnTQ',
    clientId: '7hdpq9lbf0km3noeglgmg26cpm',
    redirectUri: 'http://localhost:4300/callback' // igualita a la de Cognito
  },
  // Dev calls the API Gateway directly
  apiBase: 'https://k2ok2k1ft9.execute-api.us-east-1.amazonaws.com/dev',
  apiUrl: 'https://k2ok2k1ft9.execute-api.us-east-1.amazonaws.com/dev'
};
