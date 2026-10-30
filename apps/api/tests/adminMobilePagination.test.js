import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = name => readFileSync(new URL(`../../admin-mobile/app/${name}.tsx`, import.meta.url), 'utf8');
function compile(source, start, end, deps) {
  const from = source.indexOf(start);
  assert(from >= 0);
  const to = source.indexOf(end, from);
  assert(to > from);
  const fn = source.slice(from, to).split('useCallback(')[1]
    .replaceAll('error: any', 'error').replace('pageOverride?: number,','pageOverride,')
    .replace('replaceMode?: boolean,','replaceMode,').replace('new Map<string, FeedbackItem>()', 'new Map()');
  return new Function(...Object.keys(deps), `return (${fn});`)(...Object.values(deps));
}
const noop = () => {};
test('customer focus refresh preserves page 2 and does not reset pagination', async () => {
  const source = read('customers');
  let resets=0, loads=0;
  const focus = compile(source.slice(source.indexOf('  useFocusEffect(')), '  useFocusEffect(', ', [detailVisible, loadCustomers, selectedId]),', {
    getAdminUser:async()=>({role:'ADMIN'}), setAdminRole:noop,
    loadCustomers:async()=>{loads++;}, detailVisible:false, selectedId:'',
    listRequestRef:{current:0}, setPage:()=>{resets++;}, page:2,
  });
  const cleanup=focus();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(loads,1);
  assert.equal(resets,0);
  cleanup();
});
test('late customer page 2 response cannot overwrite page 3', async () => {
  const source=read('customers');
  const ref={current:0};
  let items, meta;
  const pending={};
  function loader(page) {
    return compile(source,'  const loadCustomers = useCallback(', ', [params]);', {
      listRequestRef:ref, params:{page}, setRefreshing:noop, setLoading:noop,
      fetchCustomers:params=>new Promise(resolve=>{pending[params.page]=resolve;}),
      setItems:value=>{items=value;}, setMeta:value=>{meta=value;},
      Alert:{alert:()=>assert.fail('unexpected alert')}, console,
    });
  }
  const old=loader(2)(); const next=loader(3)();
  pending[3]({items:['page 3'],meta:{page:3}}); await next;
  pending[2]({items:['page 2'],meta:{page:2}}); await old;
  assert.deepEqual(items,['page 3']); assert.equal(meta.page,3);
});
test('feedback page 2 replaces page 1 rather than appending its rows', async () => {
  let items=['page 1'];
  const load=compile(read('feedback'),'  const loadFeedbacks = useCallback(', ',\n    [actorRole, groupTab, page, qDebounced, status],', {
    page:2, listRequestRef:{current:0}, setRefreshing:noop,setLoadingMore:noop,setLoading:noop,
    fetchAdminFeedbacks:async p=>{assert.equal(p.page,2);return {items:['page 2'],meta:{page:2}};},
    qDebounced:'',actorRole:'ALL',groupTab:'pending',status:'ALL',getStatusParam:()=>undefined,PAGE_SIZE:20,
    setMeta:noop,setItems:value=>{items=typeof value==='function'?value(items):value;},showMessage:()=>assert.fail('unexpected error'),console,
  });
  await load(); assert.deepEqual(items,['page 2']);
});
