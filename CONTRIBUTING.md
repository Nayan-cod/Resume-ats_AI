# 🤝 Contributing to ResumeAI ATS

Thank you for your interest in contributing to ResumeAI ATS! We welcome contributions from developers of all skill levels. To help ensure a smooth collaboration, please follow the guidelines below.

---

## 🗺️ Development Workflow

1.  **Fork & Clone**: Fork the repository on GitHub and clone your fork locally:
    ```bash
    git clone https://github.com/your-username/Resume-ats_AI.git
    cd Resume-ats_AI
    ```
2.  **Create a Branch**: Create a descriptive feature or bugfix branch:
    ```bash
    git checkout -b feature/add-new-metric
    ```
3.  **Implement Changes**: Follow coding standards and style guidelines (see below).
4.  **Local Testing**: Run the applications locally and verify that your changes didn't break any functionality:
    ```bash
    make dev-backend
    make dev-frontend
    ```
5.  **Commit**: Make clear, atomic commits with meaningful commit messages.
6.  **Push & PR**: Push your branch to your fork and submit a Pull Request (PR) to the main branch.

---

## 🛠️ Code Style & Standards

### Python (Backend)
*   **Style**: Follow PEP 8 guidelines.
*   **Imports**: Order imports logically: standard library, third-party libraries, local imports.
*   **Documentation**: Include docstrings and comments for non-obvious code, logic flows, and router endpoints.

### Javascript / React (Frontend)
*   **Structure**: Keep components modular, reusable, and single-purpose.
*   **Linter**: Run ESLint before committing to identify styling issues:
    ```bash
    make lint-frontend
    ```
*   **Styling**: Use utility TailwindCSS classes and maintain global configuration tokens in `tailwind.config.js`.

---

## 📌 Git Commit Message Guidelines

We follow standard conventional commit rules to keep our commit history readable and structured:

*   **`feat:`**: A new feature (e.g., `feat: add email template for candidates`)
*   **`fix:`**: A bug fix (e.g., `fix: resolve jwt token expiration error`)
*   **`docs:`**: Documentation-only changes (e.g., `docs: update setup guide in readme`)
*   **`style:`**: Changes that do not affect the meaning of the code (e.g., white-space, formatting)
*   **`refactor:`**: A code change that neither fixes a bug nor adds a feature (e.g., restructuring routers)
*   **`chore:`**: Updating build tasks, package dependencies, etc.

*Example Commit Message:*
```bash
git commit -m "feat: integrate WebSockets for live candidate scoring updates"
```

---

## ❓ Need Help?

If you have questions, run into issues, or want to discuss a new feature, please open an Issue in the GitHub repository or reach out to the project maintainers.
