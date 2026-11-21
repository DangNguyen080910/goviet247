import { useLocalSearchParams } from 'expo-router';
import DriverRulesScreen from '../../components/DriverRulesScreen';
export default function RulesDocumentScreen() {
  const {group}=useLocalSearchParams<{group:string}>();
  return <DriverRulesScreen groupId={group}/>;
}
