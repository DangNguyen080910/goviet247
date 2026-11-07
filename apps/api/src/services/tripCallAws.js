import {createHash} from 'node:crypto';
import {ChimeSDKMeetingsClient, CreateMeetingCommand, CreateAttendeeCommand, DeleteMeetingCommand} from '@aws-sdk/client-chime-sdk-meetings';
import {ChimeSDKMediaPipelinesClient, CreateMediaCapturePipelineCommand, CreateMediaConcatenationPipelineCommand, DeleteMediaCapturePipelineCommand, GetMediaPipelineCommand} from '@aws-sdk/client-chime-sdk-media-pipelines';
import {fromInstanceMetadata} from '@aws-sdk/credential-providers';
import {S3Client, GetObjectCommand, ListObjectsV2Command} from '@aws-sdk/client-s3';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
import {callError} from './tripCallPolicy.js';
const hash=value=>createHash('sha256').update(value).digest('hex');
// This provider deliberately bypasses old AWS_ACCESS_KEY_ID used by existing uploads.
// Nothing here changes the clients or credentials used by existing S3 features.
export function callAwsConfig(env=process.env) {
 const region=env.TRIP_CALL_AWS_REGION || 'ap-southeast-1';
 const bucket=env.TRIP_CALL_RECORDINGS_BUCKET;
 if (region!=='ap-southeast-1') throw callError('Cuộc gọi chỉ được cấu hình tại Singapore.',503,'CALL_CONFIG');
 if(!bucket || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) throw callError('Chưa cấu hình kho ghi âm cuộc gọi.',503,'CALL_CONFIG');
 return {region,bucket,credentials:fromInstanceMetadata({timeout:1500,maxRetries:2})};
}
export function createCallAws(env=process.env) {
 const {bucket,...config}=callAwsConfig(env);
 const meetings=new ChimeSDKMeetingsClient(config),pipelines=new ChimeSDKMediaPipelinesClient(config),s3=new S3Client(config);
 return {
  async meeting(callId) {
   const {Meeting}=await meetings.send(new CreateMeetingCommand({ClientRequestToken:hash('meeting:'+callId),ExternalMeetingId:callId,MediaRegion:config.region,
    MeetingFeatures:{Audio:{EchoReduction:'AVAILABLE'},Video:{MaxResolution:'None'},Content:{MaxResolution:'None'}}}));
   return Meeting;
  },
  async attendee(meetingId, callId, side) {
   const {Attendee}=await meetings.send(new CreateAttendeeCommand({MeetingId:meetingId,ExternalUserId:hash(`${callId}:${side}`),Capabilities:{Audio:'SendReceive',Video:'None',Content:'None'}}));
   return Attendee;
  },
  async capture(meetingArn, callId) {
   const {MediaCapturePipeline}=await pipelines.send(new CreateMediaCapturePipelineCommand({ClientRequestToken:hash('capture:'+callId),SourceType:'ChimeSdkMeeting',SourceArn:meetingArn,
    SinkType:'S3Bucket',SinkArn:`arn:aws:s3:::${bucket}/call-recordings/${callId}/capture`,
    ChimeSdkMeetingConfiguration:{ArtifactsConfiguration:{Audio:{MuxType:'AudioOnly'},Video:{State:'Disabled'},Content:{State:'Disabled'}}}}));
   return MediaCapturePipeline;
  },
  async concatenate(captureArn,callId) {
   const {MediaConcatenationPipeline}=await pipelines.send(new CreateMediaConcatenationPipelineCommand({ClientRequestToken:hash('concat:'+callId),Sources:[{Type:'MediaCapturePipeline',MediaCapturePipelineSourceConfiguration:{MediaPipelineArn:captureArn,ChimeSdkMeetingConfiguration:{ArtifactsConfiguration:{Audio:{State:'Enabled'},Video:{State:'Disabled'},Content:{State:'Disabled'},DataChannel:{State:'Disabled'},TranscriptionMessages:{State:'Disabled'},MeetingEvents:{State:'Disabled'},CompositedVideo:{State:'Disabled'}}}}}],Sinks:[{Type:'S3Bucket',S3BucketSinkConfiguration:{Destination:`arn:aws:s3:::${bucket}/call-recordings/${callId}/final`}}]}));
   return MediaConcatenationPipeline;
  },
  async stopCapture(id) {try {await pipelines.send(new DeleteMediaCapturePipelineCommand({MediaPipelineId:id}));}catch(e){if(e.name!=='NotFoundException')throw e;}},
  async stopMeeting(id) {try {await meetings.send(new DeleteMeetingCommand({MeetingId:id}));}catch(e){if(e.name!=='NotFoundException')throw e;}},
  async pipeline(id) {return pipelines.send(new GetMediaPipelineCommand({MediaPipelineId:id}));},
  async recording(callId) {
   const response=await s3.send(new ListObjectsV2Command({Bucket:bucket,Prefix:`call-recordings/${callId}/final/`,MaxKeys:100}));
   return response.Contents?.find(o=> /\/audio\/[^/]+\.mp4$/.test(o.Key || '') && o.Size>0)?.Key || null;
  },
  async recordingUrl(key,callId) {
   if(!key?.startsWith(`call-recordings/${callId}/final/`))throw callError('Ghi âm không hợp lệ.',404);
   return getSignedUrl(s3,new GetObjectCommand({Bucket:bucket,Key:key,ResponseContentType:'audio/mp4'}),{expiresIn:60});
  }
 };
}
