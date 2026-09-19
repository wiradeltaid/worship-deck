; Script generated for Inno Setup 6+
; SPEC-47-03: Standalone Desktop Packaging Pipeline for Worship Presenter Web

#define MyAppName "Worship Presenter Web"
#define MyAppVersion "0.1.0"
#define MyAppPublisher "Wira Delta Indonesia"
#define MyAppURL "https://github.com/wiradeltaid/worship-presenter-web"
#define MyAppExeName "worship-presenter.exe"
#define MyAppId "{{8B237F02-4A82-41D1-9B5C-27806D678F12}"

[Setup]
AppId={#MyAppId}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\Worship Presenter Web
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=..\dist-installer
OutputBaseFilename=WorshipPresenterSetup
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog

; SPEC-47-01 / SPEC-47-03 Single-Instance Mutex Guards
AppMutex=Local\WorshipPresenter.SingleInstance,Global\WorshipPresenter.SingleInstance
CloseApplications=yes
CloseApplicationsFilter=*.exe
RestartApplications=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; Read-only Application Binaries and Assets in {app}
Source: "..\dist-desktop\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\dist-desktop\package.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\dist-desktop\runtime\*"; DestDir: "{app}\runtime"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\dist-desktop\workers\*"; DestDir: "{app}\workers"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\dist-desktop\src\*"; DestDir: "{app}\src"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\dist-desktop\node_modules\*"; DestDir: "{app}\node_modules"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\spa\dist\*"; DestDir: "{app}\spa\dist"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Clean up only application program files and staged bundles, NEVER delete %LocalAppData%\WorshipPresenter
Type: filesandordirs; Name: "{app}\spa"
Type: filesandordirs; Name: "{app}\runtime"
Type: filesandordirs; Name: "{app}\workers"
Type: filesandordirs; Name: "{app}\src"
Type: filesandordirs; Name: "{app}\node_modules"
Type: files; Name: "{app}\{#MyAppExeName}"
Type: files; Name: "{app}\package.json"

[Code]
// Data preservation guarantee:
// Verify that user database (%LocalAppData%\WorshipPresenter\data.db) is preserved across uninstalls.
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  DataDir: String;
begin
  if CurUninstallStep = usPostUninstall then
  begin
    DataDir := ExpandConstant('{localappdata}\WorshipPresenter');
    // Deliberate invariant: User data in %LocalAppData%\WorshipPresenter is never removed during uninstallation.
    Log('Data preservation invariant: Preserving user data directory at ' + DataDir);
  end;
end;
