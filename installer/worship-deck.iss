; Script generated for Inno Setup 6+
; Production Standalone Desktop Packaging Pipeline for WorshipDeck

#define MyAppName "WorshipDeck"
#ifndef MyAppVersion
  #error "MyAppVersion must be supplied via /D from package.json"
#endif
#define MyAppPublisher "Wira Delta Indonesia"
#define MyAppURL "https://github.com/wiradeltaid/worship-deck"
#define MyAppExeName "worship-deck.exe"
#define MyAppId "{{8B237F02-4A82-41D1-9B5C-27806D678F12}"

[Setup]
AppId={#MyAppId}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\WorshipDeck
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=..\dist-installer
OutputBaseFilename=WorshipDeck-{#MyAppVersion}-x64-setup
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
SetupIconFile=worship-deck.ico
WizardImageFile=..\public\installer\wizard-image.bmp
WizardSmallImageFile=..\public\installer\wizard-small.bmp
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog

; Single-Instance Mutex Guards (Supports both new and legacy mutex)
AppMutex=Local\WorshipDeck.SingleInstance,Local\WorshipPresenter.SingleInstance,Global\WorshipDeck.SingleInstance
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
Source: "worship-deck.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\dist-desktop\runtime\*"; DestDir: "{app}\runtime"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\dist-desktop\workers\*"; DestDir: "{app}\workers"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\dist-desktop\src\*"; DestDir: "{app}\src"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\dist-desktop\node_modules\*"; DestDir: "{app}\node_modules"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\dist-desktop\data\*"; DestDir: "{app}\data"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\dist-desktop\LICENSE"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\dist-desktop\ATTRIBUTIONS.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\dist-desktop\THIRD-PARTY-NOTICES"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\spa\dist\*"; DestDir: "{app}\spa\dist"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Parameters: "--desktop"; IconFilename: "{app}\worship-deck.ico"; WorkingDir: "{app}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"; IconFilename: "{app}\worship-deck.ico"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Parameters: "--desktop"; IconFilename: "{app}\worship-deck.ico"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Parameters: "--desktop"; WorkingDir: "{app}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Clean up only application program files and staged bundles, NEVER delete %LocalAppData%\WorshipDeck
Type: filesandordirs; Name: "{app}\spa"
Type: filesandordirs; Name: "{app}\runtime"
Type: filesandordirs; Name: "{app}\workers"
Type: filesandordirs; Name: "{app}\src"
Type: filesandordirs; Name: "{app}\node_modules"
Type: filesandordirs; Name: "{app}\data"
Type: files; Name: "{app}\{#MyAppExeName}"
Type: files; Name: "{app}\package.json"
Type: files; Name: "{app}\LICENSE"
Type: files; Name: "{app}\ATTRIBUTIONS.md"
Type: files; Name: "{app}\THIRD-PARTY-NOTICES"

[Code]
// Data preservation guarantee:
// Verify that user database (%LocalAppData%\WorshipDeck\data.db) is preserved across uninstalls.
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  DataDir: String;
begin
  if CurUninstallStep = usPostUninstall then
  begin
    DataDir := ExpandConstant('{localappdata}\WorshipDeck');
    // Deliberate invariant: User data in %LocalAppData%\WorshipDeck is never removed during uninstallation.
    Log('Data preservation invariant: Preserving user data directory at ' + DataDir);
  end;
end;
