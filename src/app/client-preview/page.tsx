import { apiUrl } from '@/config'
import { IClient, ICustomField, ISettings } from '@/types/interfaces'
import { defaultBannerImagePath, defaultBgColor } from '@/utils/constants'
import { CopilotAPI } from '@/utils/copilotApiUtils'
import { prepareCustomLabel } from '@/utils/customLabels'
import { getPreviewMode } from '@/utils/previewMode'
import { safeCompile } from '@/utils/safeCompile'
import { preprocessTemplate } from '@/utils/string'
import Head from 'next/head'
import Image from 'next/image'
import { z } from 'zod'
import { defaultState } from '../../../defaultState'
import ClientPreview from '../components/ClientPreview'
import InvalidToken from '../components/InvalidToken'
import { NoPreviewSupport } from './NoPreviewSupport'

export const revalidate = 0

async function getSettings(token: string) {
  try {
    const { data } = await fetch(`${apiUrl}/api/settings?token=${token}`).then(
      (res) => res.json(),
    )
    return data
  } catch (error: unknown) {
    console.error({ error })
    throw error
  }
}

async function getClient(clientId: string, token: string): Promise<IClient> {
  try {
    const res = await fetch(
      `${apiUrl}/api/client?clientId=${clientId}&token=${token}`,
    )
    if (!res.ok) {
      throw new Error(`No client found with '${token}' token`)
    }
    const { data } = await res.json()
    return data
  } catch (error: unknown) {
    console.error({ error })
    throw error
  }
}

async function getCompany(companyId: string, token: string) {
  try {
    const res = await fetch(
      `${apiUrl}/api/companies?companyId=${companyId}&token=${token}`,
    )
    if (!res.ok) {
      throw new Error(`No company found with '${token}' token`)
    }

    const { data } = await res.json()
    return data
  } catch (error: unknown) {
    console.error({ error })
    throw error
  }
}

async function getCustomFields(token: string) {
  const copilotClient = new CopilotAPI(token)
  const customFieldsList = await copilotClient.getCustomFields()
  return ((customFieldsList && customFieldsList.data) || []) as ICustomField[]
}

export default async function ClientPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ token: string }>
}) {
  const tokenParsed = z.string().safeParse((await searchParams).token)
  if (!tokenParsed.success) {
    return <InvalidToken />
  }

  const token = tokenParsed.data
  const copilotClient = new CopilotAPI(token)
  const tokenPayload = await copilotClient.getTokenPayload()
  if (!tokenPayload) {
    return <InvalidToken />
  }

  if (getPreviewMode(tokenPayload)) {
    return <NoPreviewSupport />
  }

  const clientId = z.string().uuid().safeParse(tokenPayload.clientId)
  if (!clientId.success || !tokenPayload.companyId) {
    return <InvalidToken />
  }

  let settings: ISettings = {
    content: defaultState,
    backgroundColor: defaultBgColor,
    id: '',
    bannerImage: {
      id: '',
      url: '',
      filename: '',
      contentType: '',
      size: 0,
      createdById: '',
    },
    createdById: '',
    displayTasks: false,
  }

  const [defaultSetting, allCustomFields, _client, workspace] =
    await Promise.all([
      getSettings(token),
      getCustomFields(token),
      getClient(clientId.data, token),
      copilotClient.getWorkspaceInfo(),
    ])

  const company = await getCompany(
    z.string().uuid().parse(tokenPayload.companyId),
    token,
  )

  if (defaultSetting) {
    settings = {
      ...defaultSetting,
      content: defaultSetting?.content || defaultState,
    }
  }

  const template = safeCompile(
    preprocessTemplate(
      prepareCustomLabel(settings?.content, workspace.labels, {
        isClientMode: true,
      }),
    ),
  )

  //add comma separator for custom fields
  const customFields: any = _client?.customFields

  for (const key in customFields) {
    // Check if the value is an array and if the key exists in allCustomFields
    if (
      Array.isArray(customFields[key]) &&
      allCustomFields.some((field) => field.key === key)
    ) {
      // Map the values to their corresponding labels
      customFields[key] = customFields[key].map((value: string[]) => {
        const option: any = (allCustomFields as any)
          .find((field: any) => field.key === key)
          .options.find((opt: any) => opt.key === value)
        return option ? ' ' + option.label : ' ' + value
      })
    }
  }

  if (customFields) {
    for (const key of Object.keys(customFields)) {
      if (customFields[key]?.fullAddress) {
        customFields[key] = customFields[key].fullAddress
      }
    }
  }

  const client = {
    ..._client,
    ...customFields,
    company: company?.name,
  }

  const htmlContent = template({
    client,
    workspace: { brandName: workspace.brandName },
  })

  const bannerImgUrl = !defaultSetting
    ? defaultBannerImagePath
    : settings?.bannerImage?.url

  return (
    <>
      <Head>
        <link
          href={`https://fonts.googleapis.com/css2?family=${workspace.font}&display=swap`}
          rel='stylesheet'
        />
      </Head>
      <div
        className={`overflow-y-auto overflow-x-hidden max-h-screen w-full`}
        style={{
          fontFamily: workspace.font?.replaceAll('+', ' '),
          background: `${settings.backgroundColor}`,
        }}
      >
        {bannerImgUrl && (
          <Image
            className='w-full'
            src={bannerImgUrl}
            alt='banner image'
            width={0}
            height={0}
            sizes='100vw'
            style={{
              width: '100%',
              height: '25vh',
              objectFit: 'cover',
            }}
          />
        )}
        <div
          className='px-14 py-350 max-w-xl'
          style={{
            background: `${settings.backgroundColor}`,
            margin: '0 auto',
          }}
        >
          <ClientPreview
            content={htmlContent}
            settings={settings}
            token={token}
            font={workspace.font}
            labels={workspace.labels}
          />
        </div>
      </div>
    </>
  )
}
