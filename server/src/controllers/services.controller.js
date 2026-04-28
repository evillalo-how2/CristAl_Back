const {
  findAllServices,
  findServiceById,
  findServiceBySlug,
  createService,
  updateService,
  deleteService
} = require("../models/services.model");

function normalizeIsActive(value) {
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  if (value === 1 || value === 0) {
    return value;
  }

  if (value === "1" || value === "0") {
    return Number(value);
  }

  return null;
}

function validateServicePayload(payload) {
  const errors = [];

  if (!payload.name || typeof payload.name !== "string") {
    errors.push("name is required and must be a string");
  }

  if (!payload.slug || typeof payload.slug !== "string") {
    errors.push("slug is required and must be a string");
  }

  if (
    payload.short_description !== undefined &&
    payload.short_description !== null &&
    typeof payload.short_description !== "string"
  ) {
    errors.push("short_description must be a string");
  }

  const duration = Number(payload.duration_minutes);
  if (!Number.isInteger(duration) || duration <= 0) {
    errors.push("duration_minutes must be a positive integer");
  }

  const priceFrom =
    payload.price_from === null || payload.price_from === undefined || payload.price_from === ""
      ? null
      : Number(payload.price_from);

  const priceTo =
    payload.price_to === null || payload.price_to === undefined || payload.price_to === ""
      ? null
      : Number(payload.price_to);

  if (priceFrom !== null && Number.isNaN(priceFrom)) {
    errors.push("price_from must be a valid number");
  }

  if (priceTo !== null && Number.isNaN(priceTo)) {
    errors.push("price_to must be a valid number");
  }

  if (priceFrom !== null && priceTo !== null && priceTo < priceFrom) {
    errors.push("price_to cannot be less than price_from");
  }

  const isActive = normalizeIsActive(payload.is_active);
  if (isActive === null) {
    errors.push("is_active must be boolean, 0, or 1");
  }

  return {
    errors,
    normalizedData: {
      name: String(payload.name || "").trim(),
      slug: String(payload.slug || "").trim(),
      short_description:
        payload.short_description === undefined || payload.short_description === null
          ? null
          : String(payload.short_description).trim(),
      duration_minutes: duration,
      price_from: priceFrom,
      price_to: priceTo,
      is_active: isActive
    }
  };
}

async function getAllServices(req, res) {
  try {
    const services = await findAllServices();
    return res.status(200).json(services);
  } catch (error) {
    return res.status(500).json({
      message: "Error retrieving services",
      error: error.message
    });
  }
}

async function getServiceById(req, res) {
  try {
    const { id } = req.params;
    const service = await findServiceById(id);

    if (!service) {
      return res.status(404).json({
        message: "Service not found"
      });
    }

    return res.status(200).json(service);
  } catch (error) {
    return res.status(500).json({
      message: "Error retrieving service",
      error: error.message
    });
  }
}

async function createNewService(req, res) {
  try {
    const { errors, normalizedData } = validateServicePayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        message: "Validation error",
        errors
      });
    }

    const existingService = await findServiceBySlug(normalizedData.slug);

    if (existingService) {
      return res.status(409).json({
        message: "A service with this slug already exists"
      });
    }

    const createdService = await createService(normalizedData);

    return res.status(201).json({
      message: "Service created successfully",
      data: createdService
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error creating service",
      error: error.message
    });
  }
}

async function updateExistingService(req, res) {
  try {
    const { id } = req.params;
    const existingService = await findServiceById(id);

    if (!existingService) {
      return res.status(404).json({
        message: "Service not found"
      });
    }

    const mergedPayload = {
      ...existingService,
      ...req.body
    };

    const { errors, normalizedData } = validateServicePayload(mergedPayload);

    if (errors.length > 0) {
      return res.status(400).json({
        message: "Validation error",
        errors
      });
    }

    const serviceWithSameSlug = await findServiceBySlug(normalizedData.slug);

    if (serviceWithSameSlug && Number(serviceWithSameSlug.id) !== Number(id)) {
      return res.status(409).json({
        message: "Another service with this slug already exists"
      });
    }

    const updatedService = await updateService(id, normalizedData);

    return res.status(200).json({
      message: "Service updated successfully",
      data: updatedService
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error updating service",
      error: error.message
    });
  }
}

async function deleteExistingService(req, res) {
  try {
    const { id } = req.params;
    const existingService = await findServiceById(id);

    if (!existingService) {
      return res.status(404).json({
        message: "Service not found"
      });
    }

    const wasDeleted = await deleteService(id);

    if (!wasDeleted) {
      return res.status(400).json({
        message: "Service could not be deleted"
      });
    }

    return res.status(200).json({
      message: "Service deleted successfully",
      data: existingService
    });
  } catch (error) {
    if (error.errno === 1451) {
      return res.status(409).json({
        message: "Service cannot be deleted because it is being used by other records"
      });
    }

    return res.status(500).json({
      message: "Error deleting service",
      error: error.message
    });
  }
}

module.exports = {
  getAllServices,
  getServiceById,
  createNewService,
  updateExistingService,
  deleteExistingService
};