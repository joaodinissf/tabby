'use client'

import {
  createContext,
  CSSProperties,
  MouseEventHandler,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import defaultFavicon from '@/assets/default-favicon.png'
import { Message } from 'ai'
import DOMPurify from 'dompurify'
import he from 'he'
import { marked } from 'marked'
import { nanoid } from 'nanoid'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

import { SESSION_STORAGE_KEY } from '@/lib/constants'
import { useEnableDeveloperMode, useEnableSearch } from '@/lib/experiment-flags'
import { useCurrentTheme } from '@/lib/hooks/use-current-theme'
import { useLatest } from '@/lib/hooks/use-latest'
import { useIsChatEnabled } from '@/lib/hooks/use-server-info'
import { useTabbyAnswer } from '@/lib/hooks/use-tabby-answer'
import fetcher from '@/lib/tabby/fetcher'
import {
  AnswerEngineExtraContext,
  AnswerRequest,
  AnswerResponse,
  ArrayElementType,
  RelevantCodeContext
} from '@/lib/types'
import { cn, formatLineHashForCodeBrowser } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { CodeBlock } from '@/components/ui/codeblock'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger
} from '@/components/ui/hover-card'
import {
  IconBlocks,
  IconBug,
  IconChevronLeft,
  IconChevronRight,
  IconLayers,
  IconPlus,
  IconRefresh,
  IconSparkles,
  IconSpinner,
  IconStop
} from '@/components/ui/icons'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup
} from '@/components/ui/resizable'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ButtonScrollToBottom } from '@/components/button-scroll-to-bottom'
import { ClientOnly } from '@/components/client-only'
import { CopyButton } from '@/components/copy-button'
import { BANNER_HEIGHT, useShowDemoBanner } from '@/components/demo-banner'
import { MemoizedReactMarkdown } from '@/components/markdown'
import TextAreaSearch from '@/components/textarea-search'
import { ThemeToggle } from '@/components/theme-toggle'
import { UserAvatar } from '@/components/user-avatar'
import UserPanel from '@/components/user-panel'

import './search.css'

import { compact, isNil, pick } from 'lodash-es'
import { ImperativePanelHandle } from 'react-resizable-panels'
import { Context } from 'tabby-chat-panel/index'
import { useQuery } from 'urql'

import { RepositoryListQuery } from '@/lib/gql/generates/graphql'
import { repositoryListQuery } from '@/lib/tabby/query'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { CodeReferences } from '@/components/chat/question-answer'

import { DevPanel } from './dev-panel'

interface Source {
  title: string
  link: string
  snippet: string
}

type ConversationMessage = Message & {
  relevant_code?: AnswerResponse['relevant_code']
  relevant_documents?: AnswerResponse['relevant_documents']
  relevant_questions?: string[]
  code_query?: AnswerRequest['code_query']
  isLoading?: boolean
  error?: string
}

type SearchContextValue = {
  isLoading: boolean
  onRegenerateResponse: (id: string) => void
  onSubmitSearch: (question: string) => void
  extraRequestContext: Record<string, any>
  repositoryList: RepositoryListQuery['repositoryList'] | undefined
  setDevPanelOpen: (v: boolean) => void
  setConversationIdForDev: (v: string | undefined) => void
}

export const SearchContext = createContext<SearchContextValue>(
  {} as SearchContextValue
)

const tabbyFetcher = ((url: string, init?: RequestInit) => {
  return fetcher(url, {
    ...init,
    responseFormatter(response) {
      return response
    },
    errorHandler(response) {
      throw new Error(response ? String(response.status) : 'Fail to fetch')
    }
  })
}) as typeof fetch

const SOURCE_CARD_STYLE = {
  compress: 5.3,
  expand: 6.3
}

export function Search() {
  const isChatEnabled = useIsChatEnabled()
  const [searchFlag] = useEnableSearch()
  const [conversation, setConversation] = useState<ConversationMessage[]>([])
  const [showStop, setShowStop] = useState(true)
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const [title, setTitle] = useState('')
  const [isReady, setIsReady] = useState(false)
  const [extraContext, setExtraContext] = useState<AnswerEngineExtraContext>({})
  const [currentLoadindId, setCurrentLoadingId] = useState<string>('')
  const contentContainerRef = useRef<HTMLDivElement>(null)
  const [showSearchInput, setShowSearchInput] = useState(false)
  const [isShowDemoBanner] = useShowDemoBanner()
  const router = useRouter()
  const initCheckRef = useRef(false)
  const { theme } = useCurrentTheme()
  const [devPanelOpen, setDevPanelOpen] = useState(false)
  const [conversationIdForDev, setConversationIdForDev] = useState<
    string | undefined
  >()
  const devPanelRef = useRef<ImperativePanelHandle>(null)
  const [devPanelSize, setDevPanelSize] = useState(45)
  const prevDevPanelSize = useRef(devPanelSize)

  const [{ data }] = useQuery({
    query: repositoryListQuery
  })
  const repositoryList = data?.repositoryList

  const { triggerRequest, isLoading, error, answer, stop } = useTabbyAnswer({
    fetcher: tabbyFetcher
  })

  const isLoadingRef = useLatest(isLoading)

  const currentConversationForDev = useMemo(() => {
    return conversation.find(item => item.id === conversationIdForDev)
  }, [conversationIdForDev, conversation])

  const valueForDev = useMemo(() => {
    if (currentConversationForDev) {
      return pick(
        currentConversationForDev,
        'relevant_documents',
        'relevant_code'
      )
    }
    return {
      answers: conversation
        .filter(o => o.role === 'assistant')
        .map(o => pick(o, 'relevant_documents', 'relevant_code'))
    }
  }, [
    conversationIdForDev,
    currentConversationForDev?.relevant_documents,
    currentConversationForDev?.relevant_code
  ])

  const onPanelLayout = (sizes: number[]) => {
    if (sizes?.[1]) {
      setDevPanelSize(sizes[1])
    }
  }

  // Check sessionStorage for initial message or most recent conversation
  useEffect(() => {
    if (initCheckRef.current) return

    initCheckRef.current = true

    const initialMessage = sessionStorage.getItem(
      SESSION_STORAGE_KEY.SEARCH_INITIAL_MSG
    )
    const initialExtraContextStr = sessionStorage.getItem(
      SESSION_STORAGE_KEY.SEARCH_INITIAL_EXTRA_CONTEXT
    )
    const initialExtraInfo = initialExtraContextStr
      ? JSON.parse(initialExtraContextStr)
      : undefined
    if (initialMessage) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY.SEARCH_INITIAL_MSG)
      sessionStorage.removeItem(
        SESSION_STORAGE_KEY.SEARCH_INITIAL_EXTRA_CONTEXT
      )
      setIsReady(true)
      setExtraContext(p => ({
        ...p,
        repository: initialExtraInfo?.repository
      }))
      // FIXME(jueliang) just use the value in context
      onSubmitSearch(initialMessage, {
        repository: initialExtraInfo?.repository
      })
      return
    }

    router.replace('/')
  }, [])

  // Set page title to the value of the first quesiton
  useEffect(() => {
    if (title) document.title = title
  }, [title])

  // Display the input field with a delayed animatio
  useEffect(() => {
    if (isReady) {
      setTimeout(() => {
        setShowSearchInput(true)
      }, 300)
    }
  }, [isReady])

  // Initialize the reference to the ScrollArea used for scrolling to the bottom
  useEffect(() => {
    setContainer(
      contentContainerRef?.current?.children[1] as HTMLDivElement | null
    )
  }, [contentContainerRef?.current])

  // Handling the stream response from useTabbyAnswer
  useEffect(() => {
    const newConversation = [...conversation]
    const currentAnswer = newConversation.find(
      item => item.id === currentLoadindId
    )

    if (!currentAnswer) return

    currentAnswer.content = answer?.answer_delta || ''
    currentAnswer.relevant_code = answer?.relevant_code
    currentAnswer.relevant_documents = answer?.relevant_documents
    currentAnswer.relevant_questions = answer?.relevant_questions
    currentAnswer.isLoading = isLoading
    setConversation(newConversation)
  }, [isLoading, answer])

  // Handling the error response from useTabbyAnswer
  useEffect(() => {
    if (error) {
      const newConversation = [...conversation]
      const currentAnswer = newConversation.find(
        item => item.id === currentLoadindId
      )
      if (currentAnswer) {
        currentAnswer.error =
          error.message === '401' ? 'Unauthorized' : 'Fail to fetch'
        currentAnswer.isLoading = false
      }
    }
  }, [error])

  // Delay showing the stop button
  let showStopTimeoutId: number
  useEffect(() => {
    if (isLoadingRef.current) {
      showStopTimeoutId = window.setTimeout(() => {
        if (!isLoadingRef.current) return
        setShowStop(true)

        // Scroll to the bottom
        if (container) {
          const isLastAnswerLoading =
            currentLoadindId === conversation[conversation.length - 1].id
          if (isLastAnswerLoading) {
            container.scrollTo({
              top: container.scrollHeight,
              behavior: 'smooth'
            })
          }
        }
      }, 300)
    }

    if (!isLoadingRef.current) {
      setShowStop(false)
    }

    return () => {
      window.clearTimeout(showStopTimeoutId)
    }
  }, [isLoading])

  // Stop stream before closing the page
  useEffect(() => {
    return () => {
      if (isLoadingRef.current) stop()
    }
  }, [])

  useEffect(() => {
    if (devPanelOpen) {
      devPanelRef.current?.expand()
      devPanelRef.current?.resize(devPanelSize)
    } else {
      devPanelRef.current?.collapse()
    }
  }, [devPanelOpen])

  const onSubmitSearch = (question: string, ctx?: AnswerEngineExtraContext) => {
    const previousMessages = conversation.map(message => ({
      role: message.role,
      id: message.id,
      content: message.content
    }))
    const previousUserId = previousMessages.length > 0 && previousMessages[0].id
    const newAssistantId = nanoid()
    const newUserMessage: ConversationMessage = {
      id: previousUserId || nanoid(),
      role: 'user',
      content: question
    }
    const newAssistantMessage: ConversationMessage = {
      id: newAssistantId,
      role: 'assistant',
      content: '',
      isLoading: true
    }

    const _repository = ctx?.repository || extraContext?.repository
    const code_query: AnswerRequest['code_query'] = _repository
      ? { git_url: _repository.gitUrl, content: '' }
      : undefined
    const answerRequest: AnswerRequest = {
      messages: [...previousMessages, newUserMessage],
      doc_query: true,
      generate_relevant_questions: true,
      collect_relevant_code_using_user_message: true,
      code_query
    }

    setCurrentLoadingId(newAssistantId)
    setConversation(
      [...conversation].concat([newUserMessage, newAssistantMessage])
    )
    triggerRequest(answerRequest)

    // Update HTML page title
    if (!title) setTitle(question)
  }

  const onRegenerateResponse = (
    id: string,
    conversationData?: ConversationMessage[]
  ) => {
    const data = conversationData || conversation
    const targetAnswerIdx = data.findIndex(item => item.id === id)
    if (targetAnswerIdx < 1) return
    const targetQuestionIdx = targetAnswerIdx - 1
    const targetQuestion = data[targetQuestionIdx]

    const previousMessages = data.slice(0, targetQuestionIdx).map(message => ({
      role: message.role,
      id: message.id,
      content: message.content,
      code_query: message.code_query
    }))
    const newUserMessage: ConversationMessage = {
      role: 'user',
      id: targetQuestion.id,
      content: targetQuestion.content
    }
    const answerRequest: AnswerRequest = {
      messages: [...previousMessages, newUserMessage],
      code_query: extraContext?.repository
        ? { git_url: extraContext.repository.gitUrl, content: '' }
        : undefined,
      doc_query: true,
      generate_relevant_questions: true,
      collect_relevant_code_using_user_message: true
    }

    const newConversation = [...data]
    let newTargetAnswer = newConversation[targetAnswerIdx]
    newTargetAnswer.content = ''
    newTargetAnswer.relevant_code = undefined
    newTargetAnswer.relevant_documents = undefined
    newTargetAnswer.error = undefined
    newTargetAnswer.isLoading = true

    setCurrentLoadingId(newTargetAnswer.id)
    setConversation(newConversation)
    triggerRequest(answerRequest)
  }

  const onToggleFullScreen = (fullScreen: boolean) => {
    let nextSize = prevDevPanelSize.current
    if (fullScreen) {
      nextSize = 100
    } else if (nextSize === 100) {
      nextSize = 45
    }
    devPanelRef.current?.resize(nextSize)
    setDevPanelSize(nextSize)
    prevDevPanelSize.current = devPanelSize
  }

  if (!searchFlag.value || !isChatEnabled || !isReady) {
    return <></>
  }

  const style = isShowDemoBanner
    ? { height: `calc(100vh - ${BANNER_HEIGHT})` }
    : { height: '100vh' }

  return (
    <SearchContext.Provider
      value={{
        isLoading,
        onRegenerateResponse,
        onSubmitSearch,
        extraRequestContext: extraContext,
        repositoryList,
        setDevPanelOpen,
        setConversationIdForDev
      }}
    >
      <div className="transition-all" style={style}>
        <ResizablePanelGroup direction="vertical" onLayout={onPanelLayout}>
          <ResizablePanel>
            <header className="flex h-16 items-center justify-between px-4">
              <div className="flex items-center gap-x-6">
                <Button
                  variant="ghost"
                  className="-ml-1 pl-0 text-sm text-muted-foreground"
                  onClick={() => router.back()}
                >
                  <IconChevronLeft className="mr-1 h-5 w-5" />
                  Home
                </Button>
              </div>
              <div className="flex items-center gap-x-6">
                <ClientOnly>
                  <ThemeToggle />
                </ClientOnly>
                <UserPanel showHome={false} showSetting>
                  <UserAvatar className="h-10 w-10 border" />
                </UserPanel>
              </div>
            </header>

            <main className="h-[calc(100%-4rem)] overflow-auto pb-8 lg:pb-0">
              <ScrollArea className="h-full" ref={contentContainerRef}>
                <div className="mx-auto px-4 pb-32 lg:max-w-4xl lg:px-0">
                  <div className="flex flex-col">
                    {conversation.map((item, idx) => {
                      if (item.role === 'user') {
                        return (
                          <div key={item.id + idx}>
                            {idx !== 0 && <Separator />}
                            <div className="pb-2 pt-8">
                              <MessageMarkdown
                                message={item.content}
                                headline
                              />
                            </div>
                          </div>
                        )
                      }
                      if (item.role === 'assistant') {
                        return (
                          <div key={item.id + idx} className="pb-8 pt-2">
                            <AnswerBlock
                              answer={item}
                              showRelatedQuestion={
                                idx === conversation.length - 1
                              }
                            />
                          </div>
                        )
                      }
                      return <></>
                    })}
                  </div>
                </div>
              </ScrollArea>

              {container && (
                <ButtonScrollToBottom
                  className="!fixed !bottom-[5.4rem] !right-4 !top-auto z-40 border-muted-foreground lg:!bottom-[2.85rem]"
                  container={container}
                  offset={100}
                  // On mobile browsers(Chrome & Safari) in dark mode, using `background: hsl(var(--background))`
                  // result in `rgba(0, 0, 0, 0)`. To prevent this, explicitly set --background
                  style={
                    theme === 'dark'
                      ? ({ '--background': '0 0% 12%' } as CSSProperties)
                      : {}
                  }
                />
              )}

              <div
                className={cn(
                  'fixed bottom-5 left-0 z-30 flex min-h-[5rem] w-full flex-col items-center gap-y-2',
                  {
                    'opacity-100 translate-y-0': showSearchInput,
                    'opacity-0 translate-y-10': !showSearchInput,
                    hidden: devPanelOpen
                  }
                )}
                style={Object.assign(
                  { transition: 'all 0.35s ease-out' },
                  theme === 'dark'
                    ? ({ '--background': '0 0% 12%' } as CSSProperties)
                    : {}
                )}
              >
                <Button
                  className={cn('bg-background', {
                    'opacity-0 pointer-events-none': !showStop,
                    'opacity-100': showStop
                  })}
                  style={{
                    transition: 'opacity 0.55s ease-out'
                  }}
                  variant="outline"
                  onClick={stop}
                >
                  <IconStop className="mr-2" />
                  Stop generating
                </Button>
                <div
                  className={cn(
                    'relative z-20 flex justify-center self-stretch px-4'
                  )}
                >
                  <TextAreaSearch
                    onSearch={onSubmitSearch}
                    className="lg:max-w-4xl"
                    placeholder="Ask a follow up question"
                    isLoading={isLoading}
                    isFollowup
                    extraContext={extraContext}
                  />
                </div>
              </div>
            </main>
          </ResizablePanel>
          <ResizableHandle
            className={cn(
              'hidden !h-[4px] border-none bg-background shadow-[0px_-4px_4px_rgba(0,0,0,0.2)] hover:bg-blue-500 active:bg-blue-500 dark:shadow-[0px_-4px_4px_rgba(255,255,255,0.2)]',
              devPanelOpen && 'block'
            )}
          />
          <ResizablePanel
            collapsible
            collapsedSize={0}
            defaultSize={0}
            ref={devPanelRef}
            onCollapse={() => setDevPanelOpen(false)}
            className="z-50"
          >
            <DevPanel
              onClose={() => setDevPanelOpen(false)}
              value={valueForDev}
              isFullScreen={devPanelSize === 100}
              onToggleFullScreen={onToggleFullScreen}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </SearchContext.Provider>
  )
}

type AnswerBlockContextValue = {
  onCodeCitationMouseEnter: (index: number) => void
  onCodeCitationMouseLeave: (index: number) => void
  onCodeCitationClick: (
    data: ArrayElementType<AnswerResponse['relevant_code']>
  ) => void
}
const AnswerBlockContext = createContext<AnswerBlockContextValue>(
  {} as AnswerBlockContextValue
)
function AnswerBlock({
  answer,
  showRelatedQuestion
}: {
  answer: ConversationMessage
  showRelatedQuestion: boolean
}) {
  const {
    onRegenerateResponse,
    onSubmitSearch,
    isLoading,
    setDevPanelOpen,
    setConversationIdForDev
  } = useContext(SearchContext)
  const [enableDeveloperMode] = useEnableDeveloperMode()

  const [showMoreSource, setShowMoreSource] = useState(false)
  const [relevantCodeHighlightIndex, setRelevantCodeHighlightIndex] = useState<
    number | undefined
  >(undefined)
  const getCopyContent = (answer: ConversationMessage) => {
    if (!answer.relevant_documents) return answer.content

    const citationMatchRegex = /\[\[?citation:\s*\d+\]?\]/g
    const content = answer.content
      .replace(citationMatchRegex, (match, p1) => {
        const citationNumberMatch = match?.match(/\d+/)
        return `[${citationNumberMatch}]`
      })
      .trim()
    const citations = answer.relevant_documents
      .map((relevent, idx) => `[${idx + 1}] ${relevent.doc.link}`)
      .join('\n')
    return `${content}\n\nCitations:\n${citations}`
  }

  const IconAnswer = answer.isLoading ? IconSpinner : IconSparkles

  const totalHeightInRem = answer.relevant_documents
    ? Math.ceil(answer.relevant_documents.length / 4) *
        SOURCE_CARD_STYLE.expand +
      0.5 * Math.floor(answer.relevant_documents.length / 4)
    : 0

  const relevantCodeContexts: RelevantCodeContext[] = useMemo(() => {
    return (
      answer?.relevant_code?.map(hit => {
        const { scores, doc } = hit
        const start_line = doc?.start_line ?? 0
        const lineCount = doc.body.split('\n').length
        const end_line = start_line + lineCount - 1

        return {
          kind: 'file',
          range: {
            start: start_line,
            end: end_line
          },
          filepath: doc.filepath,
          content: doc.body,
          git_url: doc.git_url,
          extra: {
            scores
          }
        }
      }) ?? []
    )
  }, [answer?.relevant_code])

  const onCodeContextClick = (ctx: Context) => {
    if (!ctx.filepath) return
    const url = new URL(`${window.location.origin}/files`)
    const searchParams = new URLSearchParams()
    searchParams.append('redirect_filepath', ctx.filepath)
    searchParams.append('redirect_git_url', ctx.git_url)
    url.search = searchParams.toString()

    const lineHash = formatLineHashForCodeBrowser({
      start: ctx.range.start,
      end: ctx.range.end
    })
    if (lineHash) {
      url.hash = lineHash
    }

    window.open(url.toString())
  }

  const onCodeCitationMouseEnter = (index: number) => {
    setRelevantCodeHighlightIndex(
      index - 1 - (answer?.relevant_documents?.length || 0)
    )
  }

  const onCodeCitationMouseLeave = (index: number) => {
    setRelevantCodeHighlightIndex(undefined)
  }

  const onCodeCitationClick = (
    code: ArrayElementType<AnswerResponse['relevant_code']>
  ) => {
    const { doc } = code
    const start_line = doc?.start_line ?? 0
    const lineCount = doc.body.split('\n').length
    const end_line = start_line + lineCount - 1
    // FIXME utils
    if (!doc.filepath) return
    const url = new URL(`${window.location.origin}/files`)
    const searchParams = new URLSearchParams()
    searchParams.append('redirect_filepath', doc.filepath)
    searchParams.append('redirect_git_url', doc.git_url)
    url.search = searchParams.toString()

    const lineHash = formatLineHashForCodeBrowser({
      start: start_line,
      end: end_line
    })
    if (lineHash) {
      url.hash = lineHash
    }

    window.open(url.toString())
  }

  return (
    <AnswerBlockContext.Provider
      value={{
        onCodeCitationClick,
        onCodeCitationMouseEnter,
        onCodeCitationMouseLeave
      }}
    >
      <div className="flex flex-col gap-y-5">
        {/* Relevant documents */}
        {answer.relevant_documents && answer.relevant_documents.length > 0 && (
          <div>
            <div className="mb-1 flex items-center gap-x-2">
              <IconBlocks className="relative" style={{ top: '-0.04rem' }} />
              <p className="text-sm font-bold leading-normal">Sources</p>
            </div>
            <div
              className="gap-sm grid grid-cols-3 gap-2 overflow-hidden md:grid-cols-4"
              style={{
                transition: 'height 0.25s ease-out',
                height: showMoreSource
                  ? `${totalHeightInRem}rem`
                  : `${SOURCE_CARD_STYLE.compress}rem`
              }}
            >
              {answer.relevant_documents.map((source, index) => (
                <SourceCard
                  key={source.doc.link + index}
                  conversationId={answer.id}
                  source={source}
                  showMore={showMoreSource}
                  showDevTooltip={enableDeveloperMode.value}
                />
              ))}
            </div>
            <Button
              variant="ghost"
              className="-ml-1.5 mt-1 flex items-center gap-x-1 px-1 py-2 text-sm font-normal text-muted-foreground"
              onClick={() => setShowMoreSource(!showMoreSource)}
            >
              <IconChevronRight
                className={cn({
                  '-rotate-90': showMoreSource,
                  'rotate-90': !showMoreSource
                })}
              />
              <p>{showMoreSource ? 'Show less' : 'Show more'}</p>
            </Button>
          </div>
        )}

        {/* Answer content */}
        <div>
          <div className="mb-1 flex items-center gap-x-1.5">
            <IconAnswer
              className={cn({
                'animate-spinner': answer.isLoading
              })}
            />
            <p className="text-sm font-bold leading-none">Answer</p>
            {enableDeveloperMode.value && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setConversationIdForDev(answer.id)
                  setDevPanelOpen(true)
                }}
              >
                <IconBug />
              </Button>
            )}
          </div>

          {/* Relevant code */}
          {answer.relevant_code && answer.relevant_code.length > 0 && (
            <CodeReferences
              contexts={relevantCodeContexts}
              className="mt-1 text-sm"
              onContextClick={onCodeContextClick}
              defaultOpen
              enableTooltip={enableDeveloperMode.value}
              onTooltipClick={() => {
                setConversationIdForDev(answer.id)
                setDevPanelOpen(true)
              }}
              highlightIndex={relevantCodeHighlightIndex}
            />
          )}

          {answer.isLoading && !answer.content && (
            <Skeleton className="mt-1 h-40 w-full" />
          )}
          <MessageMarkdown
            message={answer.content}
            relevantDocuments={answer.relevant_documents}
            relevantCode={answer.relevant_code}
          />
          {answer.error && <ErrorMessageBlock error={answer.error} />}

          {!answer.isLoading && (
            <div className="mt-3 flex items-center gap-x-3 text-sm">
              <CopyButton
                className="-ml-1.5 gap-x-1 px-1 font-normal text-muted-foreground"
                value={getCopyContent(answer)}
                text="Copy"
              />
              {!isLoading && (
                <Button
                  className="flex items-center gap-x-1 px-1 font-normal text-muted-foreground"
                  variant="ghost"
                  onClick={() => onRegenerateResponse(answer.id)}
                >
                  <IconRefresh />
                  <p>Regenerate</p>
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Related questions */}
        {showRelatedQuestion &&
          !answer.isLoading &&
          answer.relevant_questions &&
          answer.relevant_questions.length > 0 && (
            <div>
              <div className="flex items-center gap-x-1.5">
                <IconLayers />
                <p className="text-sm font-bold leading-none">Suggestions</p>
              </div>
              <div className="mt-2 flex flex-col gap-y-3">
                {answer.relevant_questions?.map((related, index) => (
                  <div
                    key={index}
                    className="flex cursor-pointer items-center justify-between rounded-lg border p-4 py-3 transition-opacity hover:opacity-70"
                    onClick={onSubmitSearch.bind(null, related)}
                  >
                    <p className="w-full overflow-hidden text-ellipsis text-sm">
                      {related}
                    </p>
                    <IconPlus />
                  </div>
                ))}
              </div>
            </div>
          )}
      </div>
    </AnswerBlockContext.Provider>
  )
}

// Remove HTML and Markdown format
const normalizedText = (input: string) => {
  const sanitizedHtml = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  })
  const parsed = marked.parse(sanitizedHtml) as string
  const decoded = he.decode(parsed)
  const plainText = decoded.replace(/<\/?[^>]+(>|$)/g, '')
  return plainText
}

function SourceCard({
  conversationId,
  source,
  showMore,
  showDevTooltip
}: {
  conversationId: string
  source: ArrayElementType<AnswerResponse['relevant_documents']>
  showMore: boolean
  showDevTooltip?: boolean
}) {
  const { setDevPanelOpen, setConversationIdForDev } = useContext(SearchContext)
  const { hostname } = new URL(source.doc.link)
  const [devTooltipOpen, setDevTooltipOpen] = useState(false)

  const onOpenChange = (v: boolean) => {
    if (!showDevTooltip) return
    setDevTooltipOpen(v)
  }

  const onTootipClick: MouseEventHandler<HTMLDivElement> = e => {
    e.stopPropagation()
    setConversationIdForDev(conversationId)
    setDevPanelOpen(true)
  }

  return (
    <Tooltip
      open={devTooltipOpen}
      onOpenChange={onOpenChange}
      delayDuration={0}
    >
      <TooltipTrigger asChild>
        <div
          className="flex cursor-pointer flex-col justify-between rounded-lg border bg-card p-3 hover:bg-card/60"
          style={{
            height: showMore
              ? `${SOURCE_CARD_STYLE.expand}rem`
              : `${SOURCE_CARD_STYLE.compress}rem`,
            transition: 'all 0.25s ease-out'
          }}
          onClick={() => window.open(source.doc.link)}
        >
          <div className="flex flex-1 flex-col justify-between gap-y-1">
            <div className="flex flex-col gap-y-0.5">
              <p className="line-clamp-1 w-full overflow-hidden text-ellipsis break-all text-xs font-semibold">
                {source.doc.title}
              </p>
              <p
                className={cn(
                  ' w-full overflow-hidden text-ellipsis break-all text-xs text-muted-foreground',
                  {
                    'line-clamp-2': showMore,
                    'line-clamp-1': !showMore
                  }
                )}
              >
                {normalizedText(source.doc.snippet)}
              </p>
            </div>
            <div className="flex items-center text-xs text-muted-foreground">
              <div className="flex w-full flex-1 items-center">
                <SiteFavicon hostname={hostname} />
                <p className="ml-1 overflow-hidden text-ellipsis">
                  {hostname.replace('www.', '').split('/')[0]}
                </p>
              </div>
            </div>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent
        align="start"
        className="cursor-pointer p-2"
        onClick={onTootipClick}
      >
        <p>Score: {source.score}</p>
      </TooltipContent>
    </Tooltip>
  )
}

type RelevantDocItem = {
  type: 'doc'
  data: ArrayElementType<AnswerResponse['relevant_documents']>
}

type RelevantCodeItem = {
  type: 'code'
  data: ArrayElementType<AnswerResponse['relevant_code']>
}

type RelevantSources = Array<RelevantDocItem | RelevantCodeItem>

function MessageMarkdown({
  message,
  headline = false,
  relevantDocuments,
  relevantCode,
  onRelevantCodeClick
}: {
  message: string
  headline?: boolean
  relevantDocuments?: AnswerResponse['relevant_documents']
  relevantCode?: AnswerResponse['relevant_code']
  onRelevantCodeClick?: (
    code: ArrayElementType<AnswerResponse['relevant_code']>
  ) => void
}) {
  const relevantSources: RelevantSources = useMemo(() => {
    const docs: RelevantSources =
      relevantDocuments?.map(item => ({
        type: 'doc',
        data: item
      })) ?? []
    const code: RelevantSources =
      relevantCode?.map(item => ({
        type: 'code',
        data: item
      })) ?? []
    return compact([...docs, ...code])
  }, [relevantDocuments, relevantCode])

  const renderTextWithCitation = (nodeStr: string, index: number) => {
    const citationMatchRegex = /\[\[?citation:\s*\d+\]?\]/g
    const textList = nodeStr.split(citationMatchRegex)
    const citationList = nodeStr.match(citationMatchRegex)
    return (
      <span key={index}>
        {textList.map((text, index) => {
          const citation = citationList?.[index]
          const citationNumberMatch = citation?.match(/\d+/)
          const citationIndex = citationNumberMatch
            ? parseInt(citationNumberMatch[0], 10)
            : null
          const citationSource = !isNil(citationIndex)
            ? relevantSources?.[citationIndex - 1]
            : undefined
          const citationType = citationSource?.type
          const showcitation = citationSource && !isNil(citationIndex)

          return (
            <span key={index}>
              {text && <span>{text}</span>}
              {showcitation && (
                <>
                  {citationType === 'doc' ? (
                    <RelevantDocumentHoverCard
                      relevantDocument={citationSource.data}
                      citationIndex={citationIndex}
                    />
                  ) : citationType === 'code' ? (
                    <RelevantCodeHoverCard
                      relevantCode={citationSource.data}
                      citationIndex={citationIndex}
                    />
                  ) : null}
                </>
              )}
            </span>
          )
        })}
      </span>
    )
  }

  return (
    <MemoizedReactMarkdown
      className="prose max-w-none break-words dark:prose-invert prose-p:leading-relaxed prose-pre:mt-1 prose-pre:p-0"
      remarkPlugins={[remarkGfm, remarkMath]}
      components={{
        p({ children }) {
          if (headline) {
            return (
              <h3 className="break-anywhere cursor-text scroll-m-20 text-xl font-semibold tracking-tight">
                {children}
              </h3>
            )
          }

          if (children.length) {
            return (
              <div className="mb-2 inline-block leading-relaxed last:mb-0">
                {children.map((childrenItem, index) => {
                  if (typeof childrenItem === 'string') {
                    return renderTextWithCitation(childrenItem, index)
                  }

                  return <span key={index}>{childrenItem}</span>
                })}
              </div>
            )
          }

          return <p className="mb-2 last:mb-0">{children}</p>
        },
        li({ children }) {
          if (children && children.length) {
            return (
              <li>
                {children.map((childrenItem, index) => {
                  if (typeof childrenItem === 'string') {
                    return renderTextWithCitation(childrenItem, index)
                  }

                  return <span key={index}>{childrenItem}</span>
                })}
              </li>
            )
          }
          return <li>{children}</li>
        },
        code({ node, inline, className, children, ...props }) {
          if (children.length) {
            if (children[0] == '▍') {
              return (
                <span className="mt-1 animate-pulse cursor-default">▍</span>
              )
            }

            children[0] = (children[0] as string).replace('`▍`', '▍')
          }

          const match = /language-(\w+)/.exec(className || '')

          if (inline) {
            return (
              <code className={className} {...props}>
                {children}
              </code>
            )
          }

          return (
            <CodeBlock
              key={Math.random()}
              language={(match && match[1]) || ''}
              value={String(children).replace(/\n$/, '')}
              {...props}
            />
          )
        }
      }}
    >
      {message}
    </MemoizedReactMarkdown>
  )
}

function RelevantDocumentHoverCard({
  relevantDocument,
  citationIndex
}: {
  relevantDocument: ArrayElementType<AnswerResponse['relevant_documents']>
  citationIndex: number
}) {
  const sourceUrl = relevantDocument ? new URL(relevantDocument.doc.link) : null

  return (
    <HoverCard>
      <HoverCardTrigger>
        <span
          className="relative -top-2 mr-0.5 inline-block h-4 w-4 cursor-pointer rounded-full bg-muted text-center text-xs"
          onClick={() => window.open(relevantDocument.doc.link)}
        >
          {citationIndex}
        </span>
      </HoverCardTrigger>
      <HoverCardContent className="w-96 text-sm">
        <div className="flex w-full flex-col gap-y-1">
          <div className="m-0 flex items-center space-x-1 text-xs leading-none text-muted-foreground">
            <SiteFavicon
              hostname={sourceUrl!.hostname}
              className="m-0 mr-1 leading-none"
            />
            <p className="m-0 leading-none">{sourceUrl!.hostname}</p>
          </div>
          <p
            className="m-0 cursor-pointer font-bold leading-none transition-opacity hover:opacity-70"
            onClick={() => window.open(relevantDocument.doc.link)}
          >
            {relevantDocument.doc.title}
          </p>
          <p className="m-0 line-clamp-4 leading-none">
            {normalizedText(relevantDocument.doc.snippet)}
          </p>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}

function RelevantCodeHoverCard({
  relevantCode,
  citationIndex
}: {
  relevantCode: ArrayElementType<AnswerResponse['relevant_code']>
  citationIndex: number
}) {
  const {
    onCodeCitationClick,
    onCodeCitationMouseEnter,
    onCodeCitationMouseLeave
  } = useContext(AnswerBlockContext)

  return (
    <span
      className="relative -top-2 mr-0.5 inline-block h-4 w-4 cursor-pointer rounded-full bg-muted text-center text-xs"
      onClick={() => {
        onCodeCitationClick?.(relevantCode)
      }}
      onMouseEnter={() => {
        onCodeCitationMouseEnter?.(citationIndex)
      }}
      onMouseLeave={() => {
        onCodeCitationMouseLeave?.(citationIndex)
      }}
    >
      {citationIndex}
    </span>
  )
}

function SiteFavicon({
  hostname,
  className
}: {
  hostname: string
  className?: string
}) {
  const [isLoaded, setIsLoaded] = useState(false)

  const handleImageLoad = () => {
    setIsLoaded(true)
  }

  return (
    <div className="relative h-3.5 w-3.5">
      <Image
        src={defaultFavicon}
        alt={hostname}
        width={14}
        height={14}
        className={cn(
          'absolute left-0 top-0 z-0 h-3.5 w-3.5 rounded-full leading-none',
          className
        )}
      />
      <Image
        src={`https://s2.googleusercontent.com/s2/favicons?sz=128&domain_url=${hostname}`}
        alt={hostname}
        width={14}
        height={14}
        className={cn(
          'relative z-10 h-3.5 w-3.5 rounded-full bg-card leading-none',
          className,
          {
            'opacity-0': !isLoaded
          }
        )}
        onLoad={handleImageLoad}
      />
    </div>
  )
}

function ErrorMessageBlock({ error = 'Fail to fetch' }: { error?: string }) {
  const errorMessage = useMemo(() => {
    let jsonString = JSON.stringify(
      {
        error: true,
        message: error
      },
      null,
      2
    )
    const markdownJson = '```\n' + jsonString + '\n```'
    return markdownJson
  }, [error])
  return (
    <MemoizedReactMarkdown
      className="prose-full-width prose break-words text-sm dark:prose-invert prose-p:leading-relaxed prose-pre:mt-1 prose-pre:p-0"
      remarkPlugins={[remarkGfm, remarkMath]}
      components={{
        code({ node, inline, className, children, ...props }) {
          return (
            <div {...props} className={cn(className, 'bg-zinc-950 p-2')}>
              {children}
            </div>
          )
        }
      }}
    >
      {errorMessage}
    </MemoizedReactMarkdown>
  )
}

// function ContextItem({
//   context,
//   clickable = true
// }: {
//   context: Context
//   clickable?: boolean
// }) {
//   const { onNavigateToContext } = React.useContext(ChatContext)
//   const isMultiLine =
//     !isNil(context.range?.start) &&
//     !isNil(context.range?.end) &&
//     context.range.start < context.range.end
//   const pathSegments = context.filepath.split('/')
//   const fileName = pathSegments[pathSegments.length - 1]
//   const path = pathSegments.slice(0, pathSegments.length - 1).join('/')
//   return (
//     <div
//       className={cn('rounded-md border p-2', {
//         'cursor-pointer hover:bg-accent': clickable,
//         'cursor-default pointer-events-auto': !clickable
//       })}
//       onClick={e => clickable && onNavigateToContext?.(context)}
//     >
//       <div className="flex items-center gap-1 overflow-hidden">
//         <IconFile className="shrink-0" />
//         <div className="flex-1 truncate" title={context.filepath}>
//           <span>{fileName}</span>
//           {context.range?.start && (
//             <span className="text-muted-foreground">
//               :{context.range.start}
//             </span>
//           )}
//           {isMultiLine && (
//             <span className="text-muted-foreground">-{context.range.end}</span>
//           )}
//           <span className="ml-2 text-xs text-muted-foreground">{path}</span>
//         </div>
//       </div>
//     </div>
//   )
// }
