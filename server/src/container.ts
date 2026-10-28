import { Container } from 'katal';
import { getDataSource } from './db';
import { RecordRepository } from './db/repositories/RecordRepository';
import { RecordService } from './services/RecordService';
import { AuthService } from './services/AuthService';
import { GoogleAuthService } from './services/GoogleAuthService';
import { AuditService } from './services/AuditService';
import { OrganizationService } from './services/OrganizationService';
import { QuotaService } from './services/QuotaService';
import { PolarBillingService } from './services/PolarBillingService';
import { WaterfallEnrichmentService } from './services/enrichment/WaterfallEnrichmentService';
import { CadenceEngineService } from './services/cadences/CadenceEngineService';
import { ReplyDetectorService } from './services/cadences/ReplyDetectorService';
import { MailboxRotatorService } from './services/mail/MailboxRotatorService';
import { WarmupEngineService } from './services/mail/WarmupEngineService';
import { VisitorSessionService } from './services/visitors/VisitorSessionService';
import { SlackAlertNotifier } from './services/visitors/SlackAlertNotifier';
import { ScraperFederationService } from './services/federation/ScraperFederationService';
import { VoiceAiService } from './services/voice/VoiceAiService';
import { WorkerHubService } from './services/workers/WorkerHubService';
import {
  WaterfallEnrichmentController,
  CreateCadenceController,
  AddCadenceStepController,
  EnrollCadenceRecordController,
  ReplyWebhookController,
  ListMailboxesController,
  CreateMailboxController,
  AuditMailboxController,
  TrackVisitorController,
  RegisterSiteController,
  ListSitesController,
  FederationSearchController,
  ExecuteDagPipelineController,
  ValidateDagPipelineController,
  CreateVoiceCampaignController,
  InitiateVoiceCallController,
  VoiceWebhookController,
  RegisterEdgeWorkerController,
  WorkerHeartbeatController,
  WorkerPollChunkController,
  WorkerChunkResultController,
  ListConnectedWorkersController,
  ListRecordsController,
  UpsertRecordController,
  GetRecordController,
  DeleteRecordController,
  SignupController,
  LoginController,
  RefreshTokenController,
  GoogleRedirectController,
  GoogleCallbackController,
  MeController,
  LogoutController,
  ListUserOrgsController,
  CreateOrgController,
  SwitchOrgController,
  InviteMemberController,
  AcceptInviteController,
  BillingCheckoutController,
  BillingStatusController,
  BillingPortalController,
  PolarWebhookController,
} from './controllers';

export function configureContainer(container: Container = new Container()): Container {
  // 1. Core Singletons
  container.singleton('DataSource', () => getDataSource());

  // 2. Repositories
  container.singleton(RecordRepository, () => new RecordRepository());

  // 3. Domain Services
  container.singleton(
    RecordService,
    (c) => new RecordService(c.resolve(RecordRepository))
  );
  container.singleton(GoogleAuthService, () => new GoogleAuthService());
  container.singleton(AuthService, () => new AuthService());
  container.singleton(AuditService, () => new AuditService());
  container.singleton(OrganizationService, () => new OrganizationService());
  container.singleton(QuotaService, () => new QuotaService());
  container.singleton(PolarBillingService, () => new PolarBillingService());
  container.singleton(
    WaterfallEnrichmentService,
    (c) => new WaterfallEnrichmentService(c.resolve('DataSource'), c.resolve(QuotaService))
  );
  container.singleton(
    CadenceEngineService,
    (c) => new CadenceEngineService(c.resolve('DataSource'))
  );
  container.singleton(
    ReplyDetectorService,
    (c) => new ReplyDetectorService(c.resolve('DataSource'))
  );
  container.singleton(
    MailboxRotatorService,
    (c) => new MailboxRotatorService(c.resolve('DataSource'))
  );
  container.singleton(
    WarmupEngineService,
    (c) => new WarmupEngineService(c.resolve('DataSource'))
  );
  container.singleton(SlackAlertNotifier, () => new SlackAlertNotifier());
  container.singleton(
    VisitorSessionService,
    (c) => new VisitorSessionService(c.resolve('DataSource'), c.resolve(SlackAlertNotifier))
  );
  container.singleton(ScraperFederationService, () => new ScraperFederationService());
  container.singleton(
    VoiceAiService,
    (c) => new VoiceAiService(c.resolve('DataSource'), c.resolve(QuotaService))
  );
  container.singleton(WorkerHubService, () => new WorkerHubService());

  // 4. Record Controllers
  container.bind(
    ListRecordsController,
    (c) => new ListRecordsController(c.resolve(RecordService))
  );
  container.bind(
    UpsertRecordController,
    (c) => new UpsertRecordController(c.resolve(RecordService))
  );
  container.bind(
    GetRecordController,
    (c) => new GetRecordController(c.resolve(RecordService))
  );
  container.bind(
    DeleteRecordController,
    (c) => new DeleteRecordController(c.resolve(RecordService))
  );

  // 5. Auth Controllers
  container.bind(
    SignupController,
    (c) => new SignupController(c.resolve(AuthService))
  );
  container.bind(
    LoginController,
    (c) => new LoginController(c.resolve(AuthService))
  );
  container.bind(
    RefreshTokenController,
    (c) => new RefreshTokenController(c.resolve(AuthService))
  );
  container.bind(
    GoogleRedirectController,
    (c) => new GoogleRedirectController(c.resolve(GoogleAuthService))
  );
  container.bind(
    GoogleCallbackController,
    (c) => new GoogleCallbackController(c.resolve(AuthService), c.resolve(GoogleAuthService))
  );
  container.bind(
    MeController,
    (c) => new MeController(c.resolve(AuthService))
  );
  container.bind(
    LogoutController,
    () => new LogoutController()
  );

  // 6. Organization Controllers
  container.bind(
    ListUserOrgsController,
    (c) => new ListUserOrgsController(c.resolve(OrganizationService))
  );
  container.bind(
    CreateOrgController,
    (c) => new CreateOrgController(c.resolve(OrganizationService), c.resolve(AuditService))
  );
  container.bind(
    SwitchOrgController,
    (c) => new SwitchOrgController(c.resolve(OrganizationService), c.resolve(AuditService))
  );
  container.bind(
    InviteMemberController,
    (c) => new InviteMemberController(c.resolve(OrganizationService), c.resolve(AuditService))
  );
  container.bind(
    AcceptInviteController,
    (c) => new AcceptInviteController(c.resolve(OrganizationService), c.resolve(AuditService))
  );

  // 7. Billing & Webhook Controllers
  container.bind(
    BillingCheckoutController,
    (c) => new BillingCheckoutController(c.resolve(PolarBillingService))
  );
  container.bind(
    BillingStatusController,
    (c) => new BillingStatusController(c.resolve(QuotaService))
  );
  container.bind(
    BillingPortalController,
    (c) => new BillingPortalController(c.resolve(PolarBillingService))
  );
  container.bind(
    PolarWebhookController,
    (c) => new PolarWebhookController(c.resolve(PolarBillingService))
  );

  // 8. Phase 5 Controllers
  container.bind(
    WaterfallEnrichmentController,
    (c) => new WaterfallEnrichmentController(c.resolve(WaterfallEnrichmentService))
  );
  container.bind(
    CreateCadenceController,
    (c) => new CreateCadenceController(c.resolve(CadenceEngineService))
  );
  container.bind(
    AddCadenceStepController,
    (c) => new AddCadenceStepController(c.resolve(CadenceEngineService))
  );
  container.bind(
    EnrollCadenceRecordController,
    (c) => new EnrollCadenceRecordController(c.resolve(CadenceEngineService))
  );
  container.bind(
    ReplyWebhookController,
    (c) => new ReplyWebhookController(c.resolve(ReplyDetectorService))
  );
  container.bind(
    ListMailboxesController,
    () => new ListMailboxesController()
  );
  container.bind(
    CreateMailboxController,
    (c) => new CreateMailboxController(c.resolve(MailboxRotatorService))
  );
  container.bind(
    AuditMailboxController,
    () => new AuditMailboxController()
  );
  container.bind(
    TrackVisitorController,
    (c) => new TrackVisitorController(c.resolve(VisitorSessionService))
  );
  container.bind(
    RegisterSiteController,
    () => new RegisterSiteController()
  );
  container.bind(
    ListSitesController,
    () => new ListSitesController()
  );

  // 9. Phase 6 Moat Controllers
  container.bind(
    FederationSearchController,
    (c) => new FederationSearchController(c.resolve(ScraperFederationService))
  );
  container.bind(
    ExecuteDagPipelineController,
    () => new ExecuteDagPipelineController()
  );
  container.bind(
    ValidateDagPipelineController,
    () => new ValidateDagPipelineController()
  );
  container.bind(
    CreateVoiceCampaignController,
    () => new CreateVoiceCampaignController()
  );
  container.bind(
    InitiateVoiceCallController,
    (c) => new InitiateVoiceCallController(c.resolve(VoiceAiService))
  );
  container.bind(
    VoiceWebhookController,
    (c) => new VoiceWebhookController(c.resolve(VoiceAiService))
  );
  container.bind(
    RegisterEdgeWorkerController,
    (c) => new RegisterEdgeWorkerController(c.resolve(WorkerHubService))
  );
  container.bind(
    WorkerHeartbeatController,
    (c) => new WorkerHeartbeatController(c.resolve(WorkerHubService))
  );
  container.bind(
    WorkerPollChunkController,
    (c) => new WorkerPollChunkController(c.resolve(WorkerHubService))
  );
  container.bind(
    WorkerChunkResultController,
    (c) => new WorkerChunkResultController(c.resolve(WorkerHubService))
  );
  container.bind(
    ListConnectedWorkersController,
    (c) => new ListConnectedWorkersController(c.resolve(WorkerHubService))
  );

  return container;
}

export const appContainer = configureContainer(new Container());
