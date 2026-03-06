# Nuclei Scan Results (test@gmail.com / Test@123)

Scans were run from the project root using `urls.txt` (7 URLs including dashboard endpoints).

---

## Summary

| Scan | Command | Result |
|------|---------|--------|
| **Without auth** | `nuclei -l urls.txt -severity critical,high,medium` | **26 matches** in **8m 26s** |
| **With auth** | `nuclei -l urls.txt -H "Authorization: Bearer <JWT>" -severity critical,high,medium` | See `nuclei-with-auth.log` when complete (~8 min) |

**JWT:** Obtained via `POST http://localhost:3000/api/auth/admin/login` with `{"user":"test@gmail.com","password":"Test@123"}` and saved to `.nuclei-jwt.txt`.

---

## Without-auth scan (completed)

- **Matches:** 26  
- **Duration:** 8m 26s  
- **Log:** `nuclei-without-auth.log`

**Sample findings (from log):**

- **Critical:** CVE-2014-2323, CVE-2025-2294, CVE-2025-4078, config-json-exposure-fuzz, CVE-2020-17530  
- **High:** codeigniter-env, laravel-env, generic-env, generic-linux-lfi, CVE-2021-32820, CVE-2019-7254, CVE-2020-8163 (×6 on dashboard URLs + root), CVE-2017-16894, CVE-2015-4074, CVE-2011-2744, wp-vault-local-file-inclusion, CVE-2021-39316  
- **Medium:** svn-wc-db, config-json  

Note: CVE-2020-8163 also matched on dashboard URLs (error-test, internal-secrets, search, download, activities/filter, debug) without auth; Nuclei may be matching on response behavior rather than actual RCE.

---

## With-auth scan

- **Log:** `nuclei-with-auth.log` (and terminal output).  
- When the run finishes, check the log for the line: `[INF] Scan completed in Xm. Y matches found.`

---

## How to re-run

```bash
# From project root (WSL)
cd /mnt/c/Users/DELL/Desktop/VirtuesTech/Office/Git/Virtuevulns/Virtuevulns2

# Refresh JWT (PowerShell): see docs/NUCLEI_BEFORE_AFTER_LOGIN.md

# Without auth
nuclei -l urls.txt -severity critical,high,medium | tee nuclei-without-auth.log

# With auth
./run-nuclei-with-auth.sh | tee nuclei-with-auth.log
```
