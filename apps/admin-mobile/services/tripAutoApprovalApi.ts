import {adminRequest} from './adminRequest';
export type AutoApprovalConfig = {autoApproveNewTrips:boolean;autoApproveRequeuedTrips:boolean;updatedAt:string};
export type AutoApprovalField = 'autoApproveNewTrips' | 'autoApproveRequeuedTrips';
const endpoint='/api/admin/trip-config/auto-approval';
export async function getAutoApprovalConfig():Promise<AutoApprovalConfig> {
  const data=await adminRequest(endpoint);return data.item;
}
export async function setAutoApprovalConfig(field:AutoApprovalField,value:boolean,expectedUpdatedAt:string):Promise<AutoApprovalConfig> {
  const data=await adminRequest(endpoint,{method:'PATCH',body:JSON.stringify({[field]:value,expectedUpdatedAt})});return data.item;
}
