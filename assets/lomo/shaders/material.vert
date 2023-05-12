#include canvas:shaders/pipeline/diffuse.glsl
#include frex:shaders/api/view.glsl
#include frex:shaders/api/player.glsl

vec2 taa_offset() {
	// 0: -0.25, -0.25
	// 1:  0.25, -0.25
	// 2: -0.25,  0.25
	// 3:  0.25,  0.25
	uint i = frx_renderFrames;
	return (
		vec2(float(i % 2u), float((i / 2u) % 2u)) - 0.5
	) * 0.5;
}

void frx_pipelineVertex() {
	if (frx_isGui) {
		gl_Position = frx_guiViewProjectionMatrix * frx_vertex;
		frx_distance = length(gl_Position.xyz);
	} else {
		frx_vertex += frx_modelToCamera;

		vec4 view_coord = frx_viewMatrix * frx_vertex;
		frx_distance = length(view_coord.xyz);

		vec4 camera_space_pos = frx_projectionMatrix * view_coord;

		vec3 ndc = camera_space_pos.xyz / camera_space_pos.w;
		vec3 window_space_pos = (ndc.xyz * 0.5 + 0.5) * vec3(frx_viewWidth, frx_viewHeight, 1.0);

		window_space_pos.xy += taa_offset();

		ndc = window_space_pos / vec3(frx_viewWidth, frx_viewHeight, 1.0) * 2.0 - 1.0;
		gl_Position = vec4(ndc, 1.0) * camera_space_pos.w;
	}
	pv_diffuse = p_diffuse(frx_vertexNormal);
}
