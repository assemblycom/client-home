import { copilotAPIKey, tasksAppApiKey } from '@/config'
import type { Notifications, WorkspaceInfo } from '@/types/common'
import {
  AppInstallsResponseSchema,
  ClientResponse,
  ClientResponseSchema,
  ClientsResponseSchema,
  CompanyResponse,
  CompanyResponseSchema,
  CustomFieldResponse,
  CustomFieldResponseSchema,
  MeResponse,
  MeResponseSchema,
  NotificationsSchema,
  Token,
  TokenSchema,
  WorkspaceInfoSchema,
} from '@/types/common'
import { TASKS_APP_URL } from '@/utils/constants'
import { encodePayload } from '@/utils/crypto'
import { withRetry } from '@/utils/withRetry'
import type { AssemblyAPI as SDK } from '@assembly-js/node-sdk'
import { assemblyApi } from '@assembly-js/node-sdk'
import { z } from 'zod'

export class CopilotAPI {
  copilot: SDK

  constructor(private readonly token: string) {
    this.copilot = assemblyApi({ apiKey: copilotAPIKey, token })
  }

  async _me(): Promise<MeResponse | null> {
    const tokenPayload = await this.getTokenPayload()
    const id = tokenPayload?.internalUserId || tokenPayload?.clientId
    if (!tokenPayload || !id) return null

    const retrieveCurrentUserInfo = tokenPayload.internalUserId
      ? this.copilot.retrieveInternalUser
      : this.copilot.retrieveClient
    const currentUserInfo = await retrieveCurrentUserInfo({ id })

    return MeResponseSchema.parse(currentUserInfo)
  }

  // Get parsed payload from token
  async _getTokenPayload(): Promise<Token | undefined> {
    return TokenSchema.parse(await this.copilot.getTokenPayload?.())
  }

  async _getClient(clientId: string): Promise<ClientResponse> {
    return ClientResponseSchema.parse(
      await this.copilot.retrieveClient({ id: clientId }),
    )
  }

  async _getClients() {
    return ClientsResponseSchema.parse(
      await this.copilot.listClients({ limit: 5000 }),
    )
  }

  async _getCompany(companyId: string): Promise<CompanyResponse> {
    return CompanyResponseSchema.parse(
      await this.copilot.retrieveCompany({ id: companyId }),
    )
  }

  async _getCompanies(): Promise<CompanyResponse[]> {
    return z
      .array(CompanyResponseSchema)
      .parse((await this.copilot.listCompanies({ limit: 100_000 })).data)
  }

  async _getWorkspaceInfo(): Promise<WorkspaceInfo> {
    return WorkspaceInfoSchema.parse(await this.copilot.retrieveWorkspace())
  }

  async _getCustomFields(): Promise<CustomFieldResponse> {
    return CustomFieldResponseSchema.parse(
      await this.copilot.listCustomFields({}),
    )
  }

  async _getNotifications(recipientId: string): Promise<Notifications> {
    const notifications = await this.copilot.listNotifications({
      recipientId,
    })
    return NotificationsSchema.parse(notifications.data)
  }

  async getIncompleteTaskCounts(
    clientId: string,
    companyId?: string,
  ): Promise<number> {
    const tokenPayload = await this.getTokenPayload()
    if (!tokenPayload || !tokenPayload.workspaceId) {
      throw new Error('Could not parse token')
    }

    const clientPayload = {
      workspaceId: tokenPayload.workspaceId,
      clientId,
      companyId,
    }

    const baseUrl = new URL('/api/tasks/public', TASKS_APP_URL)
    baseUrl.searchParams.set(
      'token',
      encodePayload(tasksAppApiKey, clientPayload),
    )
    baseUrl.searchParams.set('limit', '1000000')
    baseUrl.searchParams.set('parentTaskId', 'null')
    companyId && baseUrl.searchParams.set('companyId', companyId) //only includes assignned task to the logged in client.

    const todoUrl = new URL(baseUrl)
    todoUrl.searchParams.set('status', 'todo')

    const inProgressUrl = new URL(baseUrl)
    inProgressUrl.searchParams.set('status', 'inProgress')

    const processTaskResponse = async (
      res: Promise<Response>,
    ): Promise<number> =>
      res.then((res) => res.json()).then(({ data }) => data.length)

    const [todo, inProgress] = await Promise.all([
      processTaskResponse(fetch(todoUrl.toString())),
      processTaskResponse(fetch(inProgressUrl.toString())),
    ])
    return todo + inProgress
  }

  async _getAppId(appDeploymentId: string): Promise<string | null> {
    const installedApps = AppInstallsResponseSchema.parse(
      await this.copilot.listAppInstalls(),
    )
    return (
      installedApps.find((app) => app.appId === appDeploymentId)?.id || null
    )
  }

  private wrapWithRetry<Args extends unknown[], R>(
    fn: (...args: Args) => Promise<R>,
  ): (...args: Args) => Promise<R> {
    return (...args: Args): Promise<R> => withRetry(fn.bind(this), args)
  }

  me = this.wrapWithRetry(this._me)
  getTokenPayload = this.wrapWithRetry(this._getTokenPayload)
  getClient = this.wrapWithRetry(this._getClient)
  getClients = this.wrapWithRetry(this._getClients)
  getCompany = this.wrapWithRetry(this._getCompany)
  getCompanies = this.wrapWithRetry(this._getCompanies)
  getWorkspaceInfo = this.wrapWithRetry(this._getWorkspaceInfo)
  getCustomFields = this.wrapWithRetry(this._getCustomFields)
  getNotifications = this.wrapWithRetry(this._getNotifications)
  getAppId = this.wrapWithRetry(this._getAppId)
}
