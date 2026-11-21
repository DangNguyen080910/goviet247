import { Redirect } from 'expo-router';
export default function RulesRedirect() {
  return <Redirect href={{pathname:'/rules/document',params:{group:'TERMS'}}}/>;
}
