package com.tabbyml.tabby4eclipse.lsp;

import java.io.File;
import java.io.IOException;
import java.net.URI;
import java.net.URL;
import java.nio.file.InvalidPathException;
import java.util.List;
import java.util.Locale;

import org.eclipse.core.runtime.FileLocator;
import org.eclipse.core.runtime.Path;
import org.eclipse.core.runtime.Platform;
import org.eclipse.lsp4e.server.ProcessStreamConnectionProvider;
import org.osgi.framework.Bundle;

import com.tabbyml.tabby4eclipse.Activator;
import com.tabbyml.tabby4eclipse.Logger;
import com.tabbyml.tabby4eclipse.Utils;
import com.tabbyml.tabby4eclipse.git.GitProvider;
import com.tabbyml.tabby4eclipse.lsp.protocol.ClientCapabilities;
import com.tabbyml.tabby4eclipse.lsp.protocol.ClientCapabilities.TabbyClientCapabilities;
import com.tabbyml.tabby4eclipse.lsp.protocol.ClientCapabilities.TextDocumentClientCapabilities;
import com.tabbyml.tabby4eclipse.lsp.protocol.ClientInfo;
import com.tabbyml.tabby4eclipse.lsp.protocol.ClientInfo.TabbyPluginInfo;
import com.tabbyml.tabby4eclipse.lsp.protocol.ClientProvidedConfig;
import com.tabbyml.tabby4eclipse.lsp.protocol.InitializationOptions;
import com.tabbyml.tabby4eclipse.preferences.PreferencesService;

public class ConnectionProvider extends ProcessStreamConnectionProvider {
	private Logger logger = new Logger("ConnectionProvider");

	public ConnectionProvider() {
		try {
			// Find node executable
			File nodeExecutableFile = null;

			// Default: Find Node.js specified in extension settings
			String nodePathFromPreference = PreferencesService.getInstance().getNodeBinaryPath();
			if (nodePathFromPreference != null && !nodePathFromPreference.isEmpty()) {
				String nodePath = nodePathFromPreference.replaceFirst("~", System.getProperty("user.home"));
				logger.info("Node executable path from preference: " + nodePath);
				File file = new File(nodePath);
				if (file.exists() && file.canExecute()) {
					nodeExecutableFile = file;
				} else {
					logger.info("Cannot find node executable in: " + nodePath);
				}
			}

			// Fallback 1: Find Node.js specified in PATH environment variable
			if (nodeExecutableFile == null) {
				String systemPath = System.getenv("PATH");
				logger.info("Finding node executable in system paths: " + systemPath);
				if (systemPath != null) {
					String[] paths = systemPath.split(File.pathSeparator);
					for (String p : paths) {
						File file = new File(p, Utils.isWindows() ? "node.exe" : "node");
						if (file.exists() && file.canExecute()) {
							nodeExecutableFile = file;
							break;
						}
					}
				}
			}

			// Fallback 2: Find Node.js specified in extension settings
			// TODO 20250131 Remove this ASAP, for more details see the function's Javadoc
			if (nodeExecutableFile == null) {
				nodeExecutableFile = findNodeExecutableOnWindows();
			}

			if (nodeExecutableFile == null) {
				StatusInfoHolder.getInstance().setConnectionFailed(true);
				logger.error("Cannot find node executable.");
				return;
			} else {
				logger.info("Using node executable: " + nodeExecutableFile.getAbsolutePath());
			}

			// Find tabby-agent script
			Bundle bundle = Platform.getBundle(Activator.PLUGIN_ID);
			URL agentScriptUrl = FileLocator.find(bundle, new Path("tabby-agent/dist/node/index.js"));
			if (agentScriptUrl == null) {
				StatusInfoHolder.getInstance().setConnectionFailed(true);
				logger.error("Cannot find tabby-agent script.");
				return;
			}
			File agentScriptFile = new File(FileLocator.toFileURL(agentScriptUrl).getPath());
			// Setup command to start tabby-agent
			List<String> commands = List.of(nodeExecutableFile.getAbsolutePath(), agentScriptFile.getAbsolutePath(),
					"--stdio");
			logger.info("Command to start Tabby language server: " + commands.toString());
			this.setCommands(commands);
		} catch (IOException e) {
			StatusInfoHolder.getInstance().setConnectionFailed(true);
			logger.error("Failed to setup command to start Tabby language server.", e);
		}
	}

	@Override
	public Object getInitializationOptions(URI rootUri) {
		return new InitializationOptions(getProvidedConfig(), getClientInfo(), getClientCapabilities());
	}

	@Override
	public void start() throws IOException {
		super.start();
		logger.info("Tabby language server started.");
	}

	@Override
	public void stop() {
		super.stop();
		logger.info("Tabby language server stopped.");
	}

	private ClientProvidedConfig getProvidedConfig() {
		return PreferencesService.getInstance().buildClientProvidedConfig();
	}

	private ClientInfo getClientInfo() {
		TabbyPluginInfo tabbyPluginInfo = new TabbyPluginInfo();
		Bundle bundle = Platform.getBundle(Activator.PLUGIN_ID);
		tabbyPluginInfo.setName(Activator.PLUGIN_ID);
		tabbyPluginInfo.setVersion(bundle.getVersion().toString());

		ClientInfo clientInfo = new ClientInfo();
		clientInfo.setTabbyPlugin(tabbyPluginInfo);
		return clientInfo;
	}

	private ClientCapabilities getClientCapabilities() {
		TextDocumentClientCapabilities textDocumentClientCapabilities = new TextDocumentClientCapabilities();
		textDocumentClientCapabilities.setCompletion(false);
		textDocumentClientCapabilities.setInlineCompletion(true);

		TabbyClientCapabilities tabbyClientCapabilities = new TabbyClientCapabilities();
		tabbyClientCapabilities.setConfigDidChangeListener(true);
		tabbyClientCapabilities.setStatusDidChangeListener(true);
		tabbyClientCapabilities.setWorkspaceFileSystem(true);
		tabbyClientCapabilities.setGitProvider(GitProvider.getInstance().isAvailable());
		tabbyClientCapabilities.setLanguageSupport(true);

		ClientCapabilities clientCapabilities = new ClientCapabilities();
		clientCapabilities.setTextDocument(textDocumentClientCapabilities);
		clientCapabilities.setTabby(tabbyClientCapabilities);
		return clientCapabilities;
	}

	/*
	 * TODO 20250131 This is a hacky workaround, and should be removed as soon as
	 * possible.
	 *
	 * It will be possible to remove this workaround as soon as the symlink path for
	 * major versions of Node.js remains constant. A change request to this end has
	 * been submitted as of 20250131. Once this change is implemented, this fork can
	 * be removed and the extension can be directly compiled from the upstream
	 * repository again.
	 */
	private File findNodeExecutableOnWindows() {
		if (!Utils.isWindows()) {
			return null;
		}

		final String nodeJsRootPath = "C:\\Program Files\\Node.js";
		final String nodeJsTargetVersion = "node-v20";
		final File nodeJsRootFile = new File(nodeJsRootPath);
		if (nodeJsRootFile.isDirectory()) {
			for (File entry : nodeJsRootFile.listFiles()) {
				if (entry.isDirectory()
						&& entry.getName().toLowerCase(Locale.ENGLISH).startsWith(nodeJsTargetVersion)) {
					try {
						return entry.toPath().resolve("node.exe").toFile();
					} catch (InvalidPathException | UnsupportedOperationException e) {
						logger.error("Could not find Node.js executable on Windows environment.", e);
					}
				}
			}
		}

		return null;
	}
}
