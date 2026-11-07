package com.goviet247.tripcalling

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import org.json.JSONObject
import java.io.File
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

// Encrypted session in noBackupFilesDir; key never leaves Android Keystore.
internal object CallSecrets {
  private const val ALIAS="goviet247.tripcalling.session"
  private fun key():SecretKey {
    val store=KeyStore.getInstance("AndroidKeyStore").apply{load(null)}
    (store.getKey(ALIAS,null) as? SecretKey)?.let{return it}
    return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore").apply{
      init(KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
    }.generateKey()
  }
  private fun file(context:Context)=File(context.noBackupFilesDir,"goviet-call-session")
  fun read(context:Context):Map<String,String> = try {
    val bytes=file(context).readBytes()
    val cipher=Cipher.getInstance("AES/GCM/NoPadding").apply{init(Cipher.DECRYPT_MODE,key(),GCMParameterSpec(128,bytes.copyOfRange(0,12)))}
    val json=JSONObject(String(cipher.doFinal(bytes.copyOfRange(12,bytes.size)),Charsets.UTF_8))
    json.keys().asSequence().associateWith{json.getString(it)}
  } catch(_:Exception){emptyMap()}
  fun write(context:Context,value:Map<String,String>){
    val cipher=Cipher.getInstance("AES/GCM/NoPadding").apply{init(Cipher.ENCRYPT_MODE,key())}
    val bytes=cipher.iv+cipher.doFinal(JSONObject(value).toString().toByteArray(Charsets.UTF_8))
    val destination=file(context);val pending=File(context.noBackupFilesDir,"goviet-call-session.tmp")
    pending.writeBytes(bytes);check(pending.renameTo(destination)){"Không lưu được phiên gọi an toàn."}
  }
  fun clear(context:Context){file(context).delete()}
}
