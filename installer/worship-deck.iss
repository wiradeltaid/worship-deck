; Script generated for Inno Setup 6+
; Production Standalone Desktop Packaging Pipeline for WorshipDeck

#define MyAppName "WorshipDeck"
#ifndef MyAppVersion
  #error "MyAppVersion must be supplied via /D from package.json"
#endif
#define MyAppPublisher "Wira Delta Indonesia"
#define MyAppURL "https://wiradelta.com/worship-deck/"
#define MyAppSupportURL "https://github.com/wiradeltaid/worship-deck/issues"
#define MyAppUpdatesURL "https://github.com/wiradeltaid/worship-deck/releases"
#define MyAppExeName "worship-deck.exe"
#define MyAppId "{{8B237F02-4A82-41D1-9B5C-27806D678F12}"

[Setup]
AppId={#MyAppId}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppSupportURL}
AppUpdatesURL={#MyAppUpdatesURL}
DefaultDirName={autopf}\WorshipDeck
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=..\dist-installer
OutputBaseFilename=WorshipDeck-{#MyAppVersion}-x64-setup
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
SetupIconFile=worship-deck.ico
LicenseFile=..\dist-desktop\LICENSE
; Four DPI sizes (100/150/200/250%) of the modern-style 202x386; Inno picks the closest.
; Built in ops brand-identity/sampul/src/installer.py.
WizardImageFile=..\public\installer\wizard-image.png,..\public\installer\wizard-image-150.png,..\public\installer\wizard-image-200.png,..\public\installer\wizard-image-250.png
WizardSmallImageFile=..\public\installer\wizard-small.bmp
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog

; VersionInfo and Copyright metadata
VersionInfoVersion={#MyAppVersion}
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription={#MyAppName} Setup
VersionInfoCopyright=Copyright (c) 2026 {#MyAppPublisher}
VersionInfoProductName={#MyAppName}
VersionInfoProductVersion={#MyAppVersion}
VersionInfoOriginalFileName=WorshipDeck-{#MyAppVersion}-x64-setup.exe
AppCopyright=Copyright (c) 2026 {#MyAppPublisher}
UninstallDisplayName={#MyAppName}
UninstallDisplayIcon={app}\worship-deck.ico

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
Source: "..\dist-desktop\PRIVACY.md"; DestDir: "{app}"; Flags: ignoreversion
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
Type: files; Name: "{app}\PRIVACY.md"

[Code]
// Data preservation guarantee & interactive wipe option:
// Prompts the user during uninstallation whether to remove local databases in %LocalAppData%\WorshipDeck.
// If the user selects "No", the directory is preserved for future installations.
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  DataDir: String;
begin
  if CurUninstallStep = usUninstall then
  begin
    DataDir := ExpandConstant('{localappdata}\WorshipDeck');
    if DirExists(DataDir) then
    begin
      if MsgBox('Do you also want to remove all local user data, service plans, and local databases in ' + DataDir + '?' + #13#10#13#10 + 'Select "No" to keep your data for future installations.', mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES then
      begin
        Log('User confirmed local data wipe: removing ' + DataDir);
        DelTree(DataDir, True, True, True);
      end
      else
      begin
        Log('Data preservation invariant: Preserving user data directory at ' + DataDir);
      end;
    end;
  end;
end;
