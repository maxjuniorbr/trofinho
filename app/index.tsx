import { Redirect } from 'expo-router';

export default function Index() {
  // Por enquanto, redireciona para a tela de login.
  // Quando a autenticação for implementada, verificar sessão aqui.
  return <Redirect href="/(auth)/login" />;
}
