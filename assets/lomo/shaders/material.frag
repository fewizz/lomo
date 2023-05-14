#include canvas:shaders/pipeline/fog.glsl
#include canvas:shaders/pipeline/diffuse.glsl
#include canvas:shaders/pipeline/glint.glsl
#include frex:shaders/lib/math.glsl
#include frex:shaders/lib/color.glsl
#include frex:shaders/api/world.glsl
#include frex:shaders/api/view.glsl
#include frex:shaders/api/player.glsl
#include frex:shaders/api/material.glsl
#include frex:shaders/api/fragment.glsl

uniform samplerCube u_skybox;

layout(location = 0) out vec4 out_color;
layout(location = 1) out vec4 out_normal;
layout(location = 2) out vec4 out_data;

void frx_pipelineFragment() {
	vec3 geometric_normal = normalize(frx_vertexNormal);
	vec3 tangent = normalize(frx_vertexTangent.xyz);
	mat3 TBN = mat3(
		tangent,
		cross(geometric_normal, tangent),
		geometric_normal
	);

	vec3 normal = TBN * frx_fragNormal;

	frx_fragColor.rgb = pow(frx_fragColor.rgb, vec3(2.2));
	vec4 a = frx_fragColor;

	if (frx_isGui && !frx_isHand) {
		if (frx_fragEnableDiffuse) {
			vec3 normal = normalize(frx_vertexNormal);
			float light = 0.4
				+ 0.6 * clamp(dot(normal.xyz, vec3(-0.93205774, 0.26230583, -0.24393857)), 0.0, 1.0)
				+ 0.6 * clamp(dot(normal.xyz, vec3(-0.10341814, 0.9751613, 0.18816751)), 0.0, 1.0);
			float df = min(light, 1.0);
			df = df + (1.0 - df) * frx_fragEmissive;
			a *= vec4(df, df, df, 1.0);
		}
	} else {
		vec3 ndc_near = vec3(gl_FragCoord.xy, 0.0) / vec3(frx_viewWidth, frx_viewHeight, 1.0) * 2.0 - 1.0;
		vec3 ndc_far  = vec3(gl_FragCoord.xy, 1.0) / vec3(frx_viewWidth, frx_viewHeight, 1.0) * 2.0 - 1.0;

		vec4 world_near0 = frx_inverseViewProjectionMatrix * vec4(ndc_near, 1.0);
		vec4 world_far0  = frx_inverseViewProjectionMatrix * vec4(ndc_far, 1.0);
		vec3 world_near = world_near0.xyz / world_near0.w;
		vec3 world_far  = world_far0.xyz  / world_far0.w;

		vec3 dir = normalize(world_far - world_near);
		vec3 reflection = reflect(dir, normal);

		a *= mix(
			vec4(
				pow(frx_fragLight.y, 2.0) * textureLod(u_skybox, reflection, pow(frx_fragRoughness, 1.0 / 4.0) * 7.0).rgb +
				pow(frx_fragLight.x, 2.0) * vec3(1.0),
				1.0
			),
			frx_emissiveColor,
			frx_fragEmissive
		);

		float ao = frx_fragLight.z;
		a *= frx_fragEnableAo ? vec4(vec3(ao), 1.0) : vec4(1.0);
	}

	if (frx_matFlash == 1) {
		a = a * 0.25 + 0.75;
	} else if (frx_matHurt == 1) {
		a = vec4(0.25 + a.r * 0.75, a.g * 0.75, a.b * 0.75, a.a);
	}

	glintify(a, float(frx_matGlint));

	out_color = p_fog(a);
	out_color.rgb = pow(out_color.rgb, vec3(1.0 / 2.2));

	if(!frx_isHand) {
		normal = mat3(frx_viewMatrix) * normal;
	}

	out_normal = vec4(normal, 1.0);
	out_data = vec4(frx_fragLight.xy, frx_fragRoughness, 1.0);

	gl_FragDepth = gl_FragCoord.z;
}