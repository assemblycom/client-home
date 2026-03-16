'use client'

import { When } from '@/components/hoc/When'
import { useAppState } from '@/hooks/useAppState'
import { calculateFileSize } from '@/utils/calculateFileSize'
import { defaultBannerImagePath } from '@/utils/constants'
import { replaceCustomLabelsWithPlaceholders } from '@/utils/customLabels'
import { getFont } from '@/utils/font'
import { handleBannerImageUpload } from '@/utils/handleBannerImageUpload'
import { ImagePickerUtils } from '@/utils/imagePickerUtils'
import { normalizeParagraphWhitespace } from '@/utils/string'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

export const Footer = () => {
  const appState = useAppState()

  const [saving, setSaving] = useState(false)

  const saveUtility = async (payload: any) => {
    try {
      await fetch(`/api/settings?token=${appState?.appState?.token}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      const res = await fetch(
        `/api/settings?token=${appState?.appState?.token}`,
      )
      const { data } = await res.json()
      if (data) {
        appState?.setOriginalTemplate(data.content)
        appState?.setSettings(data)
      }
      setSaving(false)
      appState?.toggleChangesCreated(false)
    } catch (e) {
      console.error(e)
      setSaving(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    //get editor content
    const content = normalizeParagraphWhitespace(
      replaceCustomLabelsWithPlaceholders(
        appState?.appState.editor?.getHTML() || '',
        appState?.appState.customLabels,
      ),
    )
    let payload = {}
    const bgColor = appState?.appState.editorColor || '#ffffff'

    if (appState?.appState?.bannerImgUrl === defaultBannerImagePath) {
      const imagePickerUtils = new ImagePickerUtils()
      const imageResponse = await fetch(defaultBannerImagePath)
      const imageBlob = await imageResponse.blob()
      const imageFile = await imagePickerUtils.blobToFile(
        imageBlob,
        'bannerImg',
      )
      if (imageFile) {
        const size = calculateFileSize(imageFile)
        if (size > 4.5) {
          toast.error('File size is too large!')
          setSaving(false)
          return
        }
      }
      const data = await handleBannerImageUpload(
        imageFile as File,
        appState?.appState.token as string,
      )
      payload = {
        backgroundColor: bgColor,
        content,
        bannerImageId: data?.id,
        token: appState?.appState.token,
        displayTasks: appState?.appState.displayTasks,
        notifications: appState?.appState.settings?.notifications,
      }
      saveUtility(payload)
      return
    }

    if (!appState?.appState.bannerImgUrl) {
      payload = {
        backgroundColor: bgColor,
        content,
        token: appState?.appState.token,
        bannerImageId: null,
        displayTasks: appState?.appState.displayTasks,
        notifications: appState?.appState.settings?.notifications,
      }
      await fetch(`/api/media`, {
        method: 'DELETE',
        body: JSON.stringify({
          url: appState?.appState?.settings?.bannerImage?.url,
          token: appState?.appState?.token,
        }),
      })
      saveUtility(payload)
      return
    }

    if (
      appState?.appState.bannerImgUrl !==
      appState?.appState.settings?.bannerImage?.url
    ) {
      //upload banner image
      const imagePickerUtils = new ImagePickerUtils()
      const imageFile = await imagePickerUtils.blobToFile(
        appState?.appState.bannerImgUrl as Blob,
        'bannerImg',
      )
      if (imageFile) {
        const size = calculateFileSize(imageFile)
        if (size > 4.5) {
          toast.error('Image size is too large!')
          setSaving(false)
          return
        }
      }
      const data = await handleBannerImageUpload(
        imageFile as File,
        appState?.appState.token as string,
      )
      payload = {
        backgroundColor: bgColor,
        content: content,
        bannerImageId: data?.id,
        token: appState?.appState.token,
        displayTasks: appState?.appState.displayTasks,
        notifications: appState?.appState.settings?.notifications,
      }
    } else {
      payload = {
        backgroundColor: bgColor,
        content: content,
        token: appState?.appState.token,
        displayTasks: appState?.appState.displayTasks,
        notifications: appState?.appState.settings?.notifications,
      }
    }
    saveUtility(payload)
  }

  const handleCancel = async () => {
    if (appState?.appState.editor) {
      appState?.setEditorColor(
        appState.appState.settings?.backgroundColor as string,
      )
      appState?.appState.editor
        .chain()
        .focus()
        .setContent(appState?.appState?.settings?.content as string)
        .run()
    }
    appState?.setBannerImgUrl(
      appState?.appState.settings?.bannerImage?.url || '',
    )
    appState?.setBannerImgId(appState?.appState.settings?.bannerImage?.id || '')
    appState?.toggleChangesCreated(false)
    appState?.toggleDisplayTasks({
      override: appState?.appState.settings?.displayTasks || false,
    })
  }

  useEffect(() => {
    const t = setTimeout(() => {
      appState?.toggleChangesCreated(false)
    }, 50)

    return () => clearTimeout(t)
  }, [])

  if (appState?.appState.pauseUpdates && appState?.appState.changesCreated) {
    return (
      <div
        className='w-full flex flex-col items-center gap-1 py-4 px-6 fixed bottom-0 bg-white border-t border-slate-300'
        style={{
          fontFamily: getFont(appState),
        }}
      >
        <p className='text-[13px] text-new-dark font-semibold'>
          Client Home is currently under maintenance - you will not be able to
          make any changes to your content or settings in the meanwhile.
        </p>
        <p className='text-[13px] text-new-dark'>
          Clients will be able to view the Client Home content as usual without
          any interruptions during this time.
        </p>
      </div>
    )
  }

  return (
    <When
      condition={
        (appState?.appState.changesCreated as boolean) &&
        !appState?.appState.readOnly
      }
    >
      <div
        className='w-full flex flex-row justify-end gap-6 py-4 px-6 fixed bottom-0 bg-white border-t border-slate-300'
        style={{
          fontFamily: getFont(appState),
        }}
      >
        <button
          className='py-1 px-3 text-new-dark rounded text-[13px] rounded bg-white border border-slate-300'
          onClick={handleCancel}
        >
          Cancel
        </button>
        <button
          className='bg-new-dark py-1 px-3 text-white text-[13px] rounded'
          onClick={handleSave}
        >
          {saving ? 'Saving' : 'Save Changes'}
        </button>
      </div>
    </When>
  )
}
