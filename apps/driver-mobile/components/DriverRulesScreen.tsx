import { useCallback, useEffect, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { driverRulesRequest, type RulesDocument } from '../services/driverRulesApi';
import { useDriverRules } from '../context/DriverRulesContext';
import fallback from '../../api/src/driver-rules/default.json';
const fallbackDocument:RulesDocument={content:fallback,release:null,needsAcceptance:false,acceptance:null,changedGroupIds:[],changedSectionIds:[]};
export default function DriverRulesScreen({groupId}:{groupId?:string}) {
  const [doc,setDoc]=useState<RulesDocument|null>(null),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(''),[open,setOpen]=useState<string|null>(null);
  const {status,sync,refresh}=useDriverRules();const epoch=useRef(0),submitting=useRef(false);
  const load=useCallback(async()=>{
    const request=++epoch.current;setLoading(true);
    try {const next=await driverRulesRequest<RulesDocument>();if(request===epoch.current){setDoc(next);setError('');sync(next);}}
    catch(e){if(request===epoch.current){setError(e instanceof Error?e.message:'Chưa tải được quy định.');setDoc(old=>old||fallbackDocument);}}
    finally{if(request===epoch.current)setLoading(false);}
  },[sync]);
  useFocusEffect(useCallback(()=>{void load();return()=>{epoch.current++;};},[load]));
  useEffect(()=>{if(doc&&status.release&&(status.release.version>(doc.release?.version||0)))void load();},[doc,status.release,load]);
  const group=doc?.content.groups.find(g=>g.id===groupId);
  async function accept() {
    if(!doc?.release||!doc.needsAcceptance||submitting.current||loading||error)return;
    submitting.current=true;setSaving(true);
    try {
      await driverRulesRequest('/accept',{versionId:doc.release.id,contentHash:doc.release.contentHash,confirmed:true});
      await load();await refresh();
    } catch(e){Alert.alert('Chưa ghi nhận xác nhận',e instanceof Error?e.message:'Vui lòng thử lại.');await load();}
    finally{submitting.current=false;setSaving(false);}
  }
  function confirm() {
    if(saving||loading||!!error||!doc?.needsAcceptance)return;
    Alert.alert('Xác nhận đã đọc quy định',doc.content.confirmation,[{text:'Đọc tiếp',style:'cancel'},{text:'Xác nhận đã đọc',onPress:()=>void accept()}]);
  }
  return <SafeAreaView style={s.safe}>
    <View style={s.header}><TouchableOpacity accessibilityRole="button" accessibilityLabel="Quay lại" onPress={()=>router.back()} style={s.back}><Text style={s.arrow}>‹</Text></TouchableOpacity><Text style={s.headerTitle}>{group?.title||'Quy định & quy tắc'}</Text></View>
    <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={()=>void load()}/> }>
      {!!error&&<View style={s.warning}><Text style={s.warningText}>Chưa kiểm tra được bản mới: {error}</Text><Text style={s.copy}>Anh/chị có thể đọc nội dung đang lưu. Cần kết nối lại để xác nhận; không cần tự đăng xuất rồi đăng nhập lại.</Text><TouchableOpacity accessibilityRole="button" onPress={()=>void load()}><Text style={s.link}>Thử tải lại</Text></TouchableOpacity></View>}
      {!doc&&loading&&<ActivityIndicator/>}
      {doc&&<>
        <View style={s.card}><Text style={s.title}>{doc.content.title}</Text>
          {doc.release&&<Text style={s.copy}>Phiên bản {doc.release.version} • {new Date(doc.release.publishedAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}</Text>}
          {doc.needsAcceptance&&<><Text style={s.updated}>● Có quy định cần đọc và xác nhận</Text><Text style={s.copy}>{doc.release?.changeSummary}</Text></>}
          {doc.acceptance&&<Text style={s.accepted}>✓ Đã xác nhận ngày {new Date(doc.acceptance.acceptedAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}</Text>}
        </View>
        {!groupId&&doc.content.groups.map(g=><TouchableOpacity key={g.id} accessibilityRole="button" style={s.card} onPress={()=>router.push({pathname:'/rules/document',params:{group:g.id}})}>
          <View style={s.row}><Text style={s.title}>{g.title}</Text>{doc.changedGroupIds.includes(g.id)&&<Text style={s.updated}>Mới cập nhật</Text>}</View><Text style={s.copy}>{g.description}</Text><Text style={s.link}>Đọc nội dung ›</Text>
        </TouchableOpacity>)}
        {group&&<><Text style={s.copy}>{group.description}</Text>{group.sections.map(section=><View key={section.id} style={s.card}>
          <TouchableOpacity accessibilityRole="button" accessibilityState={{expanded:open===section.id}} onPress={()=>setOpen(open===section.id?null:section.id)}>
            {doc.changedSectionIds.includes(`${group.id}/${section.id}`)&&<Text style={s.updated}>● Mới cập nhật</Text>}
            <Text style={s.title}>{section.title} {open===section.id?'−':'+'}</Text>{!!section.summary&&<Text style={s.copy}>{section.summary}</Text>}
          </TouchableOpacity>
          {open===section.id&&section.paragraphs.map((p,i)=><Text key={i} selectable style={s.paragraph}>{p}</Text>)}
        </View>)}</>}
        {groupId&&!group&&<Text style={s.copy}>Mục này đã được cập nhật hoặc không còn trong phiên bản hiện tại. Vui lòng quay lại danh sách quy định.</Text>}
        {groupId?<TouchableOpacity accessibilityRole="button" style={s.card} onPress={()=>router.replace('/rules')}><Text style={s.link}>Quay lại danh sách để xác nhận toàn bộ quy định</Text></TouchableOpacity>:doc.release?<View style={s.card}>
          <Text style={s.copy}>Đọc toàn bộ các nhóm ở trên trước khi xác nhận. Xác nhận được lưu theo phiên bản và không thể bỏ chọn sau khi đã ghi nhận. Khi có phiên bản mới, anh/chị cần đọc và xác nhận lại.</Text>
          <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{checked:!!doc.acceptance,disabled:saving||loading||!!error||!doc.needsAcceptance}} disabled={saving||loading||!!error||!doc.needsAcceptance} onPress={confirm} style={s.checkboxRow}>
            <Text style={[s.checkbox,doc.acceptance&&s.accepted]}>{saving?'…':doc.acceptance?'☑':'☐'}</Text><Text style={s.checkboxLabel}>{doc.content.confirmation}</Text>
          </TouchableOpacity>
          {saving&&<ActivityIndicator/>}
        </View>:<Text style={s.copy}>Chưa có yêu cầu xác nhận phiên bản mới.</Text>}
      </>}
    </ScrollView>
  </SafeAreaView>;
}
const s=StyleSheet.create({
  safe:{flex:1,backgroundColor:'#EEF2F7'},header:{backgroundColor:'#fff',flexDirection:'row',alignItems:'center',padding:12,gap:8},back:{padding:10},arrow:{fontSize:32,color:'#111827'},headerTitle:{flex:1,fontSize:21,fontWeight:'800',color:'#111827'},content:{padding:16,paddingBottom:80,gap:14},
  card:{backgroundColor:'#fff',borderRadius:16,padding:18,gap:10},title:{fontSize:17,lineHeight:24,fontWeight:'700',color:'#111827',flexShrink:1},copy:{fontSize:14,lineHeight:22,color:'#4b5563'},paragraph:{fontSize:15,lineHeight:25,color:'#374151',marginTop:8},row:{flexDirection:'row',alignItems:'center',gap:8,flexWrap:'wrap'},link:{fontSize:15,lineHeight:23,color:'#1d4ed8',fontWeight:'700',paddingVertical:5},updated:{fontSize:13,lineHeight:20,color:'#c62828',fontWeight:'700'},accepted:{fontSize:14,lineHeight:22,color:'#15803d',fontWeight:'700'},warning:{backgroundColor:'#fff7ed',padding:16,borderRadius:14,gap:8},warningText:{color:'#9a3412',fontSize:14,lineHeight:22},checkboxRow:{flexDirection:'row',alignItems:'flex-start',gap:10,paddingVertical:12},checkbox:{fontSize:27,color:'#1d4ed8'},checkboxLabel:{flex:1,fontSize:15,lineHeight:24,color:'#111827'}
});
